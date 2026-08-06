import { describe, expect, it } from "vitest";
import { models } from "../src/data/catalog.js";
import { calculateMonthlyCost } from "../src/domain/cost.js";

const usage = {
  monthlyRequests: 1000,
  averageInputTokens: 1000,
  averageOutputTokens: 500,
  cacheHitRate: 0.5,
  batchShare: 0.4,
};

const discountedPrice = {
  unitTokens: 1000000,
  input: 2,
  output: 8,
  cachedInput: 0.5,
  batchInput: 1,
  batchOutput: 4,
  batchCachedInput: 0.25,
};

describe("calculateMonthlyCost", () => {
  it("分别计算普通、缓存、Batch 输入和输出成本", () => {
    const result = calculateMonthlyCost(discountedPrice, usage);

    expect(result.total).toBe(4.2);
    expect(result.inputTotal).toBe(1);
    expect(result.outputTotal).toBe(3.2);
    expect(result).toMatchObject({ normalInput: 0.6, cachedInput: 0.15, batchInput: 0.25, output: 3.2 });
  });

  it.each([
    [0, 2],
    [1, 0.5],
  ])("缓存命中率为 %d 时使用对应输入价格", (cacheHitRate, inputTotal) => {
    const result = calculateMonthlyCost(discountedPrice, {
      ...usage,
      averageOutputTokens: 0,
      cacheHitRate,
      batchShare: 0,
    });

    expect(result.inputTotal).toBe(inputTotal);
  });

  it.each([
    [0, 10],
    [1, 5],
  ])("Batch 占比为 %d 时使用对应输入输出价格", (batchShare, total) => {
    const result = calculateMonthlyCost(discountedPrice, {
      ...usage,
      averageOutputTokens: 1000,
      cacheHitRate: 0,
      batchShare,
    });

    expect(result.total).toBe(total);
  });

  it("缺少缓存和 Batch 优惠价时回退到标准价格", () => {
    const result = calculateMonthlyCost(
      { unitTokens: 1000000, input: 2, output: 8 },
      { ...usage, averageOutputTokens: 1000, batchShare: 0.5 },
    );

    expect(result.inputTotal).toBe(2);
    expect(result.outputTotal).toBe(8);
    expect(result.total).toBe(10);
  });

  it.each([
    [0, 0, 5],
    [1, 0, 0.5],
    [0, 1, 2.5],
    [0.5, 0.4, 2.2],
    [1, 1, 0.25],
  ])("Claude Opus 5 在缓存 %d、Batch %d 时叠加官方倍率", (
    cacheHitRate,
    batchShare,
    expected,
  ) => {
    const price = models.find((model) => model.id === "anthropic-claude-opus-5").pricing[0];
    const result = calculateMonthlyCost(price, {
      monthlyRequests: 1,
      averageInputTokens: 1000000,
      averageOutputTokens: 0,
      cacheHitRate,
      batchShare,
    });

    expect(result.total).toBe(expected);
  });
});
