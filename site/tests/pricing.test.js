import { describe, expect, it } from "vitest";
import {
  normalizeModel,
  normalizePricing,
  selectPriceTier,
} from "../src/domain/pricing.js";
import { models, providers } from "../src/data/catalog.js";

describe("normalizePricing", () => {
  it("把每千 Token 美元价换算为每百万 Token 人民币价", () => {
    const result = normalizePricing(
      { currency: "USD", unitTokens: 1000, input: 0.002, output: 0.008 },
      "CNY",
      [{ baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.2 }],
    );

    expect(result.input).toBe(14.4);
    expect(result.output).toBe(57.6);
    expect(result.unitTokens).toBe(1000000);
    expect(result.currency).toBe("CNY");
  });

  it("使用反向汇率进行换算", () => {
    const result = normalizePricing(
      { currency: "CNY", unitTokens: 1000000, input: 7.2, output: 14.4 },
      "USD",
      [{ baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.2 }],
    );

    expect(result.input).toBe(1);
    expect(result.output).toBe(2);
  });

  it("缺少所需汇率时抛出明确错误", () => {
    expect(() => normalizePricing(
      { currency: "EUR", unitTokens: 1000000, input: 1, output: 2 },
      "CNY",
      [{ baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.2 }],
    )).toThrow("缺少 EUR/CNY 汇率");
  });
});

describe("selectPriceTier", () => {
  const price = {
    tiers: [
      { minInputTokens: 1, maxInputTokens: 200000, input: 3, output: 15 },
      { minInputTokens: 200001, maxInputTokens: 400000, input: 6, output: 22.5 },
    ],
  };

  it("按平均输入长度选择阶梯价", () => {
    expect(selectPriceTier(price, 250000).input).toBe(6);
  });

  it.each([
    [200000, 3],
    [200001, 6],
  ])("在阶梯边界选择正确价格：%i Token", (averageInputTokens, input) => {
    expect(selectPriceTier(price, averageInputTokens).input).toBe(input);
  });

  it.each([0, -1])("输入长度为 %i 时选择最低阶梯", (averageInputTokens) => {
    const unsortedPrice = {
      tiers: [
        { minInputTokens: 100, maxInputTokens: 200, input: 6, output: 22.5 },
        { minInputTokens: 1, maxInputTokens: 99, input: 3, output: 15 },
      ],
    };

    expect(selectPriceTier(unsortedPrice, averageInputTokens).input).toBe(3);
  });

  it.each([
    ["openai-gpt-5-6-terra", 271999, 2, 0.2, 12, 1, 0.1, 6],
    ["openai-gpt-5-6-terra", 272000, 2, 0.2, 12, 1, 0.1, 6],
    ["openai-gpt-5-6-terra", 272001, 4, 0.4, 18, 2, 0.2, 9],
    ["openai-gpt-5-6-luna", 271999, 0.2, 0.02, 1.2, 0.1, 0.01, 0.6],
    ["openai-gpt-5-6-luna", 272000, 0.2, 0.02, 1.2, 0.1, 0.01, 0.6],
    ["openai-gpt-5-6-luna", 272001, 0.4, 0.04, 1.8, 0.2, 0.02, 0.9],
  ])("%s 在 %i Token 选择完整的标准、缓存与 Batch 档位", (
    modelId,
    averageInputTokens,
    input,
    cachedInput,
    output,
    batchInput,
    batchCachedInput,
    batchOutput,
  ) => {
    const model = models.find((item) => item.id === modelId);
    const selected = selectPriceTier(model.pricing[0], averageInputTokens);

    expect(selected).toMatchObject({
      input,
      cachedInput,
      output,
      batchInput,
      batchCachedInput,
      batchOutput,
    });
  });
});

describe("normalizeModel", () => {
  it("添加服务商名称并计算标准化混合单价", () => {
    const result = normalizeModel(
      {
        id: "example-model",
        providerId: "example",
        pricing: [{ currency: "USD", unitTokens: 1000000, input: 2, output: 8 }],
      },
      "CNY",
      [{ baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.2 }],
      [{ id: "example", name: "示例服务商" }],
    );

    expect(result.providerName).toBe("示例服务商");
    expect(result.normalized).toMatchObject({ input: 14.4, output: 57.6, blended: 27.36 });
  });

  it("未提供上下文长度时为真实阶梯模型选择最低档", () => {
    const model = models.find((item) => item.id === "aliyun-qwen3-max");
    const result = normalizeModel(model, "CNY", [], providers);

    expect(result.normalized).toMatchObject({ input: 2.5, output: 10, batchInput: 1.25 });
  });
});
