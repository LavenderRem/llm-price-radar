function required(value, path) {
  if (value === undefined || value === null || value === "") {
    throw new Error(path);
  }
}

function validDate(value, path) {
  required(value, path);
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(path);
  }
}

function httpsUrl(value, path) {
  required(value, path);
  if (typeof value !== "string" || !value.startsWith("https://")) {
    throw new Error(path);
  }
}

export function assertCatalog({ providers, models, exchangeRates }) {
  if (!Array.isArray(providers) || providers.length < 6) throw new Error("providers");
  if (!Array.isArray(models) || models.length === 0) throw new Error("models");

  for (const [providerIndex, provider] of providers.entries()) {
    httpsUrl(provider.officialPricingUrl, `providers[${providerIndex}].officialPricingUrl`);
  }

  const providerIds = new Set(providers.map((provider) => provider.id));
  for (const [modelIndex, model] of models.entries()) {
    required(model.id, `models[${modelIndex}].id`);
    if (!providerIds.has(model.providerId)) throw new Error(`models[${modelIndex}].providerId`);
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
      httpsUrl(price.sourceUrl, `${base}.sourceUrl`);
      validDate(price.verifiedAt, `${base}.verifiedAt`);
      validDate(price.effectiveAt, `${base}.effectiveAt`);
      if (!Number.isFinite(price.unitTokens) || price.unitTokens <= 0) {
        throw new Error(`${base}.unitTokens`);
      }
      if (!Number.isFinite(price.input) || !Number.isFinite(price.output)
        || price.input < 0 || price.output < 0) {
        throw new Error(`${base}.price`);
      }
    }
  }

  if (models.length < 12) throw new Error("models.length");

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
