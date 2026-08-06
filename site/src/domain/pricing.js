import Decimal from "decimal.js";

function exchangeMultiplier(from, to, exchangeRates) {
  if (from === to) return new Decimal(1);

  const direct = exchangeRates.find((rate) => (
    rate.baseCurrency === from && rate.quoteCurrency === to
  ));
  if (direct) return new Decimal(direct.rate);

  const inverse = exchangeRates.find((rate) => (
    rate.baseCurrency === to && rate.quoteCurrency === from
  ));
  if (inverse) return new Decimal(1).div(inverse.rate);

  throw new Error(`缺少 ${from}/${to} 汇率`);
}

export function selectPriceTier(price, averageInputTokens) {
  if (!price.tiers?.length) return price;

  if (averageInputTokens <= 0) {
    const tier = [...price.tiers].sort((left, right) => (
      left.minInputTokens - right.minInputTokens
    ))[0];
    return { ...price, ...tier, tiers: price.tiers };
  }

  const tier = price.tiers.find((item) => (
    (item.minInputTokens === undefined || averageInputTokens >= item.minInputTokens)
    && (item.maxInputTokens === undefined || averageInputTokens <= item.maxInputTokens)
  ));
  if (!tier) throw new Error("没有匹配的价格阶梯");

  return { ...price, ...tier, tiers: price.tiers };
}

export function normalizePricing(price, targetCurrency, exchangeRates) {
  const multiplier = exchangeMultiplier(price.currency, targetCurrency, exchangeRates);
  const unitMultiplier = new Decimal(1000000).div(price.unitTokens);
  const convert = (value) => value === undefined
    ? undefined
    : Number(new Decimal(value).mul(unitMultiplier).mul(multiplier).toDecimalPlaces(8));

  return {
    ...price,
    currency: targetCurrency,
    unitTokens: 1000000,
    input: convert(price.input),
    output: convert(price.output),
    cachedInput: convert(price.cachedInput),
    cacheWrite: convert(price.cacheWrite),
    batchInput: convert(price.batchInput),
    batchOutput: convert(price.batchOutput),
    batchCachedInput: convert(price.batchCachedInput),
  };
}

export function normalizeModel(model, targetCurrency, exchangeRates, providers, averageInputTokens = 0) {
  const tier = selectPriceTier(model.pricing[0], averageInputTokens);
  const normalized = normalizePricing(tier, targetCurrency, exchangeRates);

  return {
    ...model,
    providerName: providers.find((provider) => provider.id === model.providerId)?.name ?? model.providerId,
    normalized: {
      ...normalized,
      blended: Number(new Decimal(normalized.input).mul(0.7)
        .plus(new Decimal(normalized.output).mul(0.3)).toDecimalPlaces(8)),
    },
  };
}
