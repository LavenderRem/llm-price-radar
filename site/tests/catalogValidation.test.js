import { describe, expect, it } from "vitest";
import { providers as catalogProviders, models } from "../src/data/catalog.js";
import { exchangeRates } from "../src/data/exchangeRates.js";
import { updates } from "../src/data/updates.js";
import { assertCatalog } from "../src/domain/catalogValidation.js";

const providers = [
  { id: "openai", name: "OpenAI", billingCurrency: "USD", officialPricingUrl: "https://openai.com/api/pricing/" },
  { id: "anthropic", name: "Anthropic", billingCurrency: "USD", officialPricingUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { id: "google", name: "Google", billingCurrency: "USD", officialPricingUrl: "https://ai.google.dev/gemini-api/docs/pricing" },
  { id: "deepseek", name: "DeepSeek", billingCurrency: "CNY", officialPricingUrl: "https://api-docs.deepseek.com/quick_start/pricing" },
  { id: "aliyun", name: "阿里云百炼", billingCurrency: "CNY", officialPricingUrl: "https://help.aliyun.com/zh/model-studio/model-pricing" },
  { id: "zhipu", name: "智谱", billingCurrency: "CNY", officialPricingUrl: "https://open.bigmodel.cn/" },
];

function replaceFirstModel(changes) {
  return [{ ...models[0], ...changes }, ...models.slice(1)];
}

function replaceFirstPrice(changes) {
  return replaceFirstModel({
    pricing: [{ ...models[0].pricing[0], ...changes }],
  });
}

describe("assertCatalog", () => {
  it("拒绝缺少官方来源的价格版本", () => {
    const models = [{
      id: "demo-model",
      providerId: "openai",
      displayName: "Demo",
      apiModelId: "demo",
      capabilities: ["text"],
      contextWindow: 128000,
      status: "active",
      pricing: [{ currency: "USD", unitTokens: 1000000, input: 1, output: 4 }],
    }];

    expect(() => assertCatalog({ providers, models, exchangeRates: [] }))
      .toThrow("models[0].pricing[0].sourceUrl");
  });

  it("接受六家服务商的完整目录", () => {
    expect(() => assertCatalog({ providers: catalogProviders, models, exchangeRates })).not.toThrow();
    expect(new Set(models.map((model) => model.providerId)).size).toBe(6);
  });

  it.each([
    ["displayName", ""],
    ["apiModelId", ""],
    ["capabilities", []],
    ["status", ""],
  ])("拒绝固定字段无效的模型：%s", (field, value) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstModel({ [field]: value }),
      exchangeRates,
    })).toThrow(`models[0].${field}`);
  });

  it("拒绝没有价格版本的模型", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstModel({ pricing: [] }),
      exchangeRates,
    })).toThrow("models[0].pricing");
  });

  it("拒绝缺少官方价格页的服务商", () => {
    const invalidProviders = [
      { ...catalogProviders[0], officialPricingUrl: "" },
      ...catalogProviders.slice(1),
    ];

    expect(() => assertCatalog({
      providers: invalidProviders,
      models,
      exchangeRates,
    })).toThrow("providers[0].officialPricingUrl");
  });

  it.each([
    ["currency", ""],
    ["unitTokens", undefined],
    ["input", undefined],
    ["output", undefined],
    ["sourceUrl", "http://example.com/pricing"],
    ["verifiedAt", "not-a-date"],
    ["effectiveAt", "not-a-date"],
  ])("拒绝价格版本中的无效字段：%s", (field, value) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ [field]: value }),
      exchangeRates,
    })).toThrow(field === "input" || field === "output"
      ? "models[0].pricing[0].price"
      : `models[0].pricing[0].${field}`);
  });

  it.each(["baseCurrency", "quoteCurrency"])("拒绝缺少汇率币种：%s", (field) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates: [{ ...exchangeRates[0], [field]: "" }],
    })).toThrow(`exchangeRates[0].${field}`);
  });

  it("拒绝非正数汇率", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates: [{ ...exchangeRates[0], rate: 0 }],
    })).toThrow("exchangeRates[0].rate");
  });

  it("拒绝无法解析的汇率日期", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates: [{ ...exchangeRates[0], effectiveAt: "not-a-date" }],
    })).toThrow("exchangeRates[0].effectiveAt");
  });

  it("拒绝非 HTTPS 的汇率来源", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates: [{ ...exchangeRates[0], source: "source note" }],
    })).toThrow("exchangeRates[0].source");
  });

  it("每家服务商收录两个到三个具有公开 Token 价格的模型", () => {
    for (const provider of catalogProviders) {
      const providerModels = models.filter((model) => model.providerId === provider.id);
      expect(providerModels.length).toBeGreaterThanOrEqual(2);
      expect(providerModels.length).toBeLessThanOrEqual(3);
    }

    for (const model of models) {
      expect(model.pricing.length).toBeGreaterThan(0);
      for (const price of model.pricing) {
        expect(price.sourceUrl).toMatch(/^https:\/\//);
        expect(Number.isNaN(Date.parse(price.verifiedAt))).toBe(false);
        expect(Number.isNaN(Date.parse(price.effectiveAt))).toBe(false);
      }
    }
  });

  it("汇率记录使用当天可追溯的正数来源", () => {
    expect(exchangeRates).toHaveLength(1);
    expect(exchangeRates[0]).toMatchObject({
      baseCurrency: "USD",
      quoteCurrency: "CNY",
      effectiveAt: "2026-08-06",
    });
    expect(exchangeRates[0].rate).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(exchangeRates[0].effectiveAt))).toBe(false);
    expect(exchangeRates[0].source).toMatch(/^https:\/\//);
  });

  it("每个首批模型都有新增模型和价格核验记录", () => {
    for (const model of models) {
      const modelUpdates = updates.filter((update) => update.modelId === model.id);
      expect(new Set(modelUpdates.map((update) => update.type)))
        .toEqual(new Set(["model-added", "price-verified"]));
      for (const update of modelUpdates) {
        expect(update.sourceUrl).toMatch(/^https:\/\//);
        expect(update.summary).not.toBe("");
      }
    }
  });
});
