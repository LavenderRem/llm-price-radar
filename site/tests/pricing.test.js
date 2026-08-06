import { describe, expect, it } from "vitest";
import {
  normalizeModel,
  normalizePricing,
  selectPriceTier,
} from "../src/domain/pricing.js";

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
});
