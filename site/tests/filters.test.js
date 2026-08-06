import { describe, expect, it } from "vitest";
import { filterAndSortModels } from "../src/domain/filters.js";

const models = [
  {
    id: "fast",
    providerId: "google",
    displayName: "Flash",
    apiModelId: "gemini-flash",
    capabilities: ["text"],
    contextWindow: 1000000,
    status: "active",
    normalized: { input: 0.2, output: 1, blended: 0.68 },
  },
  {
    id: "reason",
    providerId: "deepseek",
    displayName: "Reasoner",
    apiModelId: "deepseek-reasoner",
    capabilities: ["reasoning"],
    contextWindow: 128000,
    status: "active",
    normalized: { input: 0.5, output: 2, blended: 1.4 },
  },
];

describe("filterAndSortModels", () => {
  it("组合服务商、能力和上下文筛选", () => {
    const result = filterAndSortModels(models, {
      query: "reason",
      providers: ["deepseek"],
      capabilities: ["reasoning"],
      minContext: 100000,
      sortBy: "input",
      sortDirection: "asc",
    });

    expect(result.map((model) => model.id)).toEqual(["reason"]);
  });

  it("在未提供数组筛选条件时保留所有 active 模型", () => {
    const result = filterAndSortModels(models, { sortBy: "input" });

    expect(result.map((model) => model.id)).toEqual(["fast", "reason"]);
  });

  it("按中文服务商名称搜索已标准化模型", () => {
    const result = filterAndSortModels([
      {
        ...models[0],
        id: "qwen",
        providerId: "aliyun",
        providerName: "阿里云百炼",
        displayName: "Qwen Max",
      },
    ], { query: "百炼", sortBy: "input", sortDirection: "asc" });

    expect(result.map((model) => model.id)).toEqual(["qwen"]);
  });

  it("稳定排序，并始终把未公开价格放在最后", () => {
    const result = filterAndSortModels([
      { ...models[1], id: "same-first", normalized: { input: 1 } },
      { ...models[0], id: "unpublished", normalized: {} },
      { ...models[0], id: "same-second", normalized: { input: 1 } },
      { ...models[0], id: "inactive", status: "retired", normalized: { input: 0.1 } },
    ], { sortBy: "input", sortDirection: "desc" });

    expect(result.map((model) => model.id))
      .toEqual(["same-first", "same-second", "unpublished"]);
  });
});
