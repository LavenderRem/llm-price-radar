import { describe, expect, it } from "vitest";
import { providers as catalogProviders, models } from "../src/data/catalog.js";
import { exchangeRates } from "../src/data/exchangeRates.js";
import { updates } from "../src/data/updates.js";
import { assertCatalog } from "../src/domain/catalogValidation.js";

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
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ sourceUrl: undefined }),
      exchangeRates,
    }))
      .toThrow("models[0].pricing[0].sourceUrl");
  });

  it("接受包含仅提供编程套餐服务商的完整目录", () => {
    expect(() => assertCatalog({ providers: catalogProviders, models, exchangeRates, updates })).not.toThrow();
    expect(catalogProviders).toHaveLength(9);
    expect(catalogProviders.map((provider) => provider.id)).toEqual(expect.arrayContaining([
      "trae",
      "codebuddy",
    ]));
    expect(new Set(models.map((model) => model.providerId)).size).toBe(6);
  });

  it("拒绝非编程套餐专属服务商缺少模型", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: models.filter((model) => model.providerId !== "openai"),
      exchangeRates,
    })).toThrow("models.providerId.openai");
  });

  it("锁定 OpenAI 官方价格字面量", () => {
    const terra = models.find((model) => model.id === "openai-gpt-5-6-terra").pricing[0];
    const luna = models.find((model) => model.id === "openai-gpt-5-6-luna").pricing[0];

    expect(terra).toMatchObject({ input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 });
    expect(luna).toMatchObject({ input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 });
  });

  it("拒绝固定六家之外的服务商集合", () => {
    const invalidProviders = catalogProviders.map((provider, index) => (
      index === catalogProviders.length - 1 ? { ...provider, id: "other" } : provider
    ));

    expect(() => assertCatalog({ providers: invalidProviders, models, exchangeRates }))
      .toThrow("providers.ids");
  });

  it("拒绝重复的服务商 ID", () => {
    const invalidProviders = catalogProviders.map((provider, index) => (
      index === catalogProviders.length - 1 ? { ...provider, id: catalogProviders[0].id } : provider
    ));

    expect(() => assertCatalog({ providers: invalidProviders, models, exchangeRates }))
      .toThrow(`providers[${catalogProviders.length - 1}].id`);
  });

  it("拒绝重复的模型 ID", () => {
    const invalidModels = models.map((model, index) => (
      index === 1 ? { ...model, id: models[0].id } : model
    ));

    expect(() => assertCatalog({ providers: catalogProviders, models: invalidModels, exchangeRates }))
      .toThrow("models[1].id");
  });

  it("拒绝所有模型都归属同一家服务商", () => {
    const invalidModels = models.map((model) => ({ ...model, providerId: "openai" }));

    expect(() => assertCatalog({ providers: catalogProviders, models: invalidModels, exchangeRates }))
      .toThrow("models.providerId.openai");
  });

  it("拒绝重复的更新记录 ID", () => {
    const invalidUpdates = updates.map((update, index) => (
      index === 1 ? { ...update, id: updates[0].id } : update
    ));

    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates,
      updates: invalidUpdates,
    })).toThrow("updates[1].id");
  });

  it("拒绝更新记录中的无效日历日期", () => {
    const invalidUpdates = [
      { ...updates[0], effectiveAt: "2026-02-30" },
      ...updates.slice(1),
    ];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates,
      updates: invalidUpdates,
    })).toThrow("updates[0].effectiveAt");
  });

  it("拒绝更新记录中的非零填充日期", () => {
    const invalidUpdates = [
      { ...updates[0], verifiedAt: "2026-8-6" },
      ...updates.slice(1),
    ];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates,
      updates: invalidUpdates,
    })).toThrow("updates[0].verifiedAt");
  });

  it.each([
    ["providerId", "anthropic", "updates[0].providerId"],
    ["type", "not-supported", "updates[0].type"],
    ["summary", "   ", "updates[0].summary"],
    ["sourceUrl", "https://example.com/price", "updates[0].sourceUrl"],
  ])("拒绝无效更新记录字段：%s", (field, value, errorPath) => {
    const invalidUpdates = [{ ...updates[0], [field]: value }, ...updates.slice(1)];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models,
      exchangeRates,
      updates: invalidUpdates,
    })).toThrow(errorPath);
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

  it("拒绝缺少计费币种的服务商", () => {
    const invalidProviders = catalogProviders.map((provider, index) => (
      index === 0 ? { ...provider, billingCurrency: "" } : provider
    ));

    expect(() => assertCatalog({ providers: invalidProviders, models, exchangeRates }))
      .toThrow("providers[0].billingCurrency");
  });

  it("拒绝价格来源使用非服务商官方域名", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ sourceUrl: "https://example.com/pricing" }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].sourceUrl");
  });

  it("拒绝价格币种与服务商计费币种不一致", () => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ currency: "CNY" }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].currency");
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

  it.each(["input", "output"])("拒绝核心价格为零：%s", (field) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ [field]: 0 }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].price");
  });

  it.each(["cachedInput", "cacheWrite", "batchInput", "batchOutput", "batchCachedInput"])(
    "拒绝负数可选价格：%s",
    (field) => {
      expect(() => assertCatalog({
        providers: catalogProviders,
        models: replaceFirstPrice({ [field]: -1 }),
        exchangeRates,
      })).toThrow(`models[0].pricing[0].${field}`);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("拒绝非有限可选价格：%s", (value) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ cachedInput: value }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].cachedInput");
  });

  it("拒绝无效的阶梯边界", () => {
    const tiers = [{ minInputTokens: 1, maxInputTokens: 0, input: 1, output: 2 }];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ tiers }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].tiers[0].maxInputTokens");
  });

  it("拒绝非正数的阶梯核心价格", () => {
    const tiers = [{ minInputTokens: 1, maxInputTokens: 10, input: 0, output: 2 }];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ tiers }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].tiers[0].price");
  });

  it("拒绝相互重叠的价格阶梯", () => {
    const tiers = [
      { minInputTokens: 1, maxInputTokens: 100, input: 1, output: 2 },
      { minInputTokens: 100, maxInputTokens: 200, input: 2, output: 4 },
    ];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ tiers }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].tiers[1].minInputTokens");
  });

  it("拒绝负数的阶梯可选价格", () => {
    const tiers = [{
      minInputTokens: 1,
      maxInputTokens: 10,
      input: 1,
      output: 2,
      batchInput: -1,
    }];

    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ tiers }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].tiers[0].batchInput");
  });

  it.each(["2026-8-6", "2026-02-30"])("拒绝非真实 YYYY-MM-DD 日期：%s", (verifiedAt) => {
    expect(() => assertCatalog({
      providers: catalogProviders,
      models: replaceFirstPrice({ verifiedAt }),
      exchangeRates,
    })).toThrow("models[0].pricing[0].verifiedAt");
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
      if (providerModels.length === 0) continue;
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
