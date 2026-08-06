import Decimal from "decimal.js";

export function calculateMonthlyCost(price, usage) {
  const unit = new Decimal(price.unitTokens);
  const requests = new Decimal(usage.monthlyRequests);
  const inputTokens = requests.mul(usage.averageInputTokens);
  const outputTokens = requests.mul(usage.averageOutputTokens);
  const cacheShare = new Decimal(usage.cacheHitRate);
  const batchShare = new Decimal(usage.batchShare);
  const normalShare = new Decimal(1).minus(batchShare);

  const uncached = inputTokens.mul(new Decimal(1).minus(cacheShare));
  const cached = inputTokens.mul(cacheShare);
  const normalInput = uncached.mul(normalShare).mul(price.input).div(unit);
  const normalCached = cached.mul(normalShare).mul(price.cachedInput ?? price.input).div(unit);
  const batchInput = uncached.mul(batchShare).mul(price.batchInput ?? price.input).div(unit);
  const batchCached = cached.mul(batchShare).mul(
    price.batchCachedInput ?? price.batchInput ?? price.cachedInput ?? price.input,
  ).div(unit);
  const normalOutput = outputTokens.mul(normalShare).mul(price.output).div(unit);
  const batchOutput = outputTokens.mul(batchShare).mul(price.batchOutput ?? price.output).div(unit);
  const inputTotal = normalInput.plus(normalCached).plus(batchInput).plus(batchCached);
  const outputTotal = normalOutput.plus(batchOutput);

  return {
    normalInput: Number(normalInput.toDecimalPlaces(8)),
    cachedInput: Number(normalCached.toDecimalPlaces(8)),
    batchInput: Number(batchInput.plus(batchCached).toDecimalPlaces(8)),
    output: Number(outputTotal.toDecimalPlaces(8)),
    inputTotal: Number(inputTotal.toDecimalPlaces(8)),
    outputTotal: Number(outputTotal.toDecimalPlaces(8)),
    total: Number(inputTotal.plus(outputTotal).toDecimalPlaces(8)),
  };
}
