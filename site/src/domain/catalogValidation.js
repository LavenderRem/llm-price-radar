function required(value, path) {
  if (value === undefined || value === null || value === "") {
    throw new Error(path);
  }
}

function validDate(value, path) {
  required(value, path);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(path);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    throw new Error(path);
  }
}

function httpsUrl(value, path) {
  required(value, path);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error(path);
    return url;
  } catch {
    throw new Error(path);
  }
}

const PROVIDER_IDS = ["openai", "anthropic", "google", "deepseek", "aliyun", "zhipu"];
const OPTIONAL_PRICES = [
  "cachedInput",
  "cacheWrite",
  "batchInput",
  "batchOutput",
  "batchCachedInput",
];

function nonNegativeOptionalPrices(price, base) {
  for (const field of OPTIONAL_PRICES) {
    if (price[field] !== undefined
      && (!Number.isFinite(price[field]) || price[field] < 0)) {
      throw new Error(`${base}.${field}`);
    }
  }
}

function validTiers(tiers, base) {
  if (!Array.isArray(tiers) || tiers.length === 0) throw new Error(base);

  let previousMax = 0;
  for (const [tierIndex, tier] of tiers.entries()) {
    const tierBase = `${base}[${tierIndex}]`;
    if (!Number.isInteger(tier.minInputTokens) || tier.minInputTokens <= 0) {
      throw new Error(`${tierBase}.minInputTokens`);
    }
    if (!Number.isInteger(tier.maxInputTokens)
      || tier.maxInputTokens < tier.minInputTokens) {
      throw new Error(`${tierBase}.maxInputTokens`);
    }
    if (tier.minInputTokens <= previousMax) {
      throw new Error(`${tierBase}.minInputTokens`);
    }
    if (!Number.isFinite(tier.input) || !Number.isFinite(tier.output)
      || tier.input <= 0 || tier.output <= 0) {
      throw new Error(`${tierBase}.price`);
    }
    nonNegativeOptionalPrices(tier, tierBase);
    previousMax = tier.maxInputTokens;
  }
}

export function assertCatalog({ providers, models, exchangeRates, updates }) {
  if (!Array.isArray(providers) || providers.length !== PROVIDER_IDS.length) {
    throw new Error("providers");
  }
  if (!Array.isArray(models) || models.length === 0) throw new Error("models");

  const providerIds = new Set();
  const providerById = new Map();
  for (const [providerIndex, provider] of providers.entries()) {
    required(provider.id, `providers[${providerIndex}].id`);
    if (providerIds.has(provider.id)) throw new Error(`providers[${providerIndex}].id`);
    providerIds.add(provider.id);
    required(provider.billingCurrency, `providers[${providerIndex}].billingCurrency`);
    const officialPricingUrl = httpsUrl(
      provider.officialPricingUrl,
      `providers[${providerIndex}].officialPricingUrl`,
    );
    providerById.set(provider.id, { ...provider, officialPricingHost: officialPricingUrl.hostname });
  }
  if (PROVIDER_IDS.some((providerId) => !providerIds.has(providerId))) {
    throw new Error("providers.ids");
  }

  const modelIds = new Set();
  const modelCountByProvider = new Map(PROVIDER_IDS.map((providerId) => [providerId, 0]));
  for (const [modelIndex, model] of models.entries()) {
    required(model.id, `models[${modelIndex}].id`);
    if (modelIds.has(model.id)) throw new Error(`models[${modelIndex}].id`);
    modelIds.add(model.id);
    if (!providerIds.has(model.providerId)) throw new Error(`models[${modelIndex}].providerId`);
    modelCountByProvider.set(model.providerId, modelCountByProvider.get(model.providerId) + 1);
  }
  for (const providerId of PROVIDER_IDS) {
    const count = modelCountByProvider.get(providerId);
    if (count < 2 || count > 3) throw new Error(`models.providerId.${providerId}`);
  }

  for (const [modelIndex, model] of models.entries()) {
    const provider = providerById.get(model.providerId);
    required(model.displayName, `models[${modelIndex}].displayName`);
    required(model.apiModelId, `models[${modelIndex}].apiModelId`);
    if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) {
      throw new Error(`models[${modelIndex}].capabilities`);
    }
    if (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0) {
      throw new Error(`models[${modelIndex}].contextWindow`);
    }
    required(model.status, `models[${modelIndex}].status`);
    if (!Array.isArray(model.pricing) || model.pricing.length === 0) {
      throw new Error(`models[${modelIndex}].pricing`);
    }
    for (const [priceIndex, price] of model.pricing.entries()) {
      const base = `models[${modelIndex}].pricing[${priceIndex}]`;
      required(price.currency, `${base}.currency`);
      if (price.currency !== provider.billingCurrency) throw new Error(`${base}.currency`);
      const sourceUrl = httpsUrl(price.sourceUrl, `${base}.sourceUrl`);
      if (sourceUrl.hostname !== provider.officialPricingHost) {
        throw new Error(`${base}.sourceUrl`);
      }
      validDate(price.verifiedAt, `${base}.verifiedAt`);
      validDate(price.effectiveAt, `${base}.effectiveAt`);
      if (!Number.isFinite(price.unitTokens) || price.unitTokens <= 0) {
        throw new Error(`${base}.unitTokens`);
      }
      if (!Number.isFinite(price.input) || !Number.isFinite(price.output)
        || price.input <= 0 || price.output <= 0) {
        throw new Error(`${base}.price`);
      }
      nonNegativeOptionalPrices(price, base);
      if (price.tiers !== undefined) validTiers(price.tiers, `${base}.tiers`);
    }
  }

  if (updates !== undefined) {
    if (!Array.isArray(updates)) throw new Error("updates");
    const updateIds = new Set();
    for (const [updateIndex, update] of updates.entries()) {
      required(update.id, `updates[${updateIndex}].id`);
      if (updateIds.has(update.id)) throw new Error(`updates[${updateIndex}].id`);
      updateIds.add(update.id);
      if (!modelIds.has(update.modelId)) throw new Error(`updates[${updateIndex}].modelId`);
    }
  }

  if (!Array.isArray(exchangeRates) || exchangeRates.length === 0) {
    throw new Error("exchangeRates");
  }

  for (const [rateIndex, exchangeRate] of exchangeRates.entries()) {
    const base = `exchangeRates[${rateIndex}]`;
    required(exchangeRate.baseCurrency, `${base}.baseCurrency`);
    required(exchangeRate.quoteCurrency, `${base}.quoteCurrency`);
    if (!Number.isFinite(exchangeRate.rate) || exchangeRate.rate <= 0) {
      throw new Error(`${base}.rate`);
    }
    validDate(exchangeRate.effectiveAt, `${base}.effectiveAt`);
    httpsUrl(exchangeRate.source, `${base}.source`);
  }
}
