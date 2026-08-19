import { describe, expect, it } from "vitest";
import { providers } from "../src/data/catalog.js";
import { codingPlans } from "../src/data/codingPlans.js";
import {
  filterAndSortCodingPlans,
  normalizeCodingPlan,
  sanitizeCodingPlanComparisonIds,
  toggleCodingPlanComparison,
  validateCodingPlans,
} from "../src/domain/codingPlans.js";

const validPlan = {
  id: "cursor-pro",
  providerId: "cursor",
  productName: "Cursor",
  planName: "Pro",
  planType: "individual-coding",
  price: { amount: 20, currency: "USD", period: "month" },
  includedUsage: "Extended limits on Agent",
  allowancePolicy: { status: "unpublished" },
  codingSurfaces: ["IDE", "Agent"],
  officialUrl: "https://cursor.com/pricing",
  verifiedAt: "2026-08-14",
  officialSummary: "Extended limits on Agent.",
  sourceUrl: "https://cursor.com/pricing",
};

describe("coding plans catalog", () => {
  it("excludes a pure chat subscription and keeps each plan tier separate", () => {
    expect(codingPlans.some((plan) => plan.productName === "ChatGPT")).toBe(false);
    expect(codingPlans.filter((plan) => plan.productName === "Cursor").map((plan) => plan.planName))
      .toEqual(expect.arrayContaining(["Free", "Pro"]));
  });

  it("includes verified personal coding plans from multiple providers without deprecated consumer products", () => {
    expect([...new Set(codingPlans.map((plan) => plan.providerId))]).toEqual(expect.arrayContaining([
      "cursor", "anthropic", "trae", "codebuddy",
    ]));
    expect(codingPlans.some((plan) => plan.productName === "Gemini Code Assist")).toBe(false);
    expect(codingPlans.some((plan) => plan.productName === "Codex")).toBe(false);
  });

  it("allows only explicitly declared official provider hostnames for coding plan sources", () => {
    const claudePlan = {
      ...validPlan,
      providerId: "anthropic",
      officialUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan",
      sourceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan",
    };

    expect(() => validateCodingPlans([claudePlan], providers)).not.toThrow();
    expect(() => validateCodingPlans([{
      ...claudePlan,
      sourceUrl: "https://sub.support.claude.com/pricing",
    }], providers)).toThrow("codingPlans[0].sourceUrl");
    expect(() => validateCodingPlans([{
      ...claudePlan,
      sourceUrl: "https://example.com/pricing",
    }], providers)).toThrow("codingPlans[0].sourceUrl");
  });

  it("uses official HTTPS sources and explicit plan types for every tier", () => {
    expect(() => validateCodingPlans(codingPlans, providers)).not.toThrow();
    for (const plan of codingPlans) {
      expect(plan.officialUrl).toMatch(/^https:\/\//);
      expect(plan.sourceUrl).toMatch(/^https:\/\//);
      expect(plan.planType).toBe("individual-coding");
    }
  });

  it("rejects an unknown provider, non-official sources, a missing coding surface, and displayable general chat", () => {
    expect(() => validateCodingPlans([{ ...validPlan, providerId: "unknown" }], providers))
      .toThrow("codingPlans[0].providerId");
    expect(() => validateCodingPlans([{ ...validPlan, sourceUrl: "http://cursor.com/pricing" }], providers))
      .toThrow("codingPlans[0].sourceUrl");
    expect(() => validateCodingPlans([{ ...validPlan, officialUrl: "https://example.com/pricing" }], providers))
      .toThrow("codingPlans[0].officialUrl");
    expect(() => validateCodingPlans([{ ...validPlan, sourceUrl: "https://example.com/pricing" }], providers))
      .toThrow("codingPlans[0].sourceUrl");
    expect(() => validateCodingPlans([{ ...validPlan, codingSurfaces: [] }], providers))
      .toThrow("codingPlans[0].codingSurfaces");
    expect(() => validateCodingPlans([{ ...validPlan, codingSurfaces: ["Chat"] }], providers))
      .toThrow("codingPlans[0].codingSurfaces");
    expect(() => validateCodingPlans([{ ...validPlan, planType: "general-chat" }], providers))
      .toThrow("codingPlans[0].planType");
  });
});

describe("coding plan domain logic", () => {
  it("keeps unpublished allowance explicit and converts only display prices", () => {
    expect(normalizeCodingPlan(validPlan, "CNY", [{ base: "USD", quote: "CNY", rate: 7 }]))
      .toMatchObject({
        price: { amount: 20, currency: "USD", period: "month" },
        displayPrice: 140,
        displayCurrency: "CNY",
        allowanceLabel: "未公开",
      });
  });

  it("uses the inverse exchange rate for CNY plans shown in USD", () => {
    const cnyPlan = { ...validPlan, price: { amount: 99, currency: "CNY", period: "month" } };

    expect(normalizeCodingPlan(cnyPlan, "USD", [{ base: "USD", quote: "CNY", rate: 6.6 }]))
      .toMatchObject({ displayPrice: 15, displayCurrency: "USD", displayPriceLabel: undefined });
  });

  it("records every current TRAE tier with its official monthly price and basic usage", () => {
    const trae = Object.fromEntries(codingPlans
      .filter((plan) => plan.providerId === "trae")
      .map((plan) => [plan.planName, plan]));

    expect(trae.Free).toMatchObject({ price: { amount: 0, currency: "USD" }, allowancePolicy: { label: "Limited usage" } });
    expect(trae.Lite).toMatchObject({ price: { amount: 3, currency: "USD" }, allowancePolicy: { label: "USD 5 Basic usage" } });
    expect(trae.Pro).toMatchObject({ price: { amount: 10, currency: "USD" }, allowancePolicy: { label: "USD 20 Basic usage" } });
    expect(trae["Pro+"]).toMatchObject({ price: { amount: 30, currency: "USD" }, allowancePolicy: { label: "USD 90 Basic usage" } });
    expect(trae.Ultra).toMatchObject({ price: { amount: 100, currency: "USD" }, allowancePolicy: { label: "USD 400 Basic usage" } });
  });

  it("keeps Claude Pro annual billing as a structured official price", () => {
    const plan = codingPlans.find((item) => item.id === "claude-code-pro");
    expect(plan).toMatchObject({ annualPrice: { amount: 200, currency: "USD", period: "year" } });
  });

  it("filters by coding surface and free plans before sorting by price", () => {
    const plans = [
      { ...validPlan, id: "paid-cli", productName: "Zeta", codingSurfaces: ["CLI"], price: { ...validPlan.price, amount: 10 } },
      { ...validPlan, id: "free-agent", productName: "Alpha", price: { ...validPlan.price, amount: 0 } },
      { ...validPlan, id: "free-ide", productName: "Beta", codingSurfaces: ["IDE"], price: { ...validPlan.price, amount: 0 } },
    ];

    expect(filterAndSortCodingPlans(plans, { surfaces: ["IDE"], freeOnly: true }).map((plan) => plan.id))
      .toEqual(["free-agent", "free-ide"]);
  });

  it("filters coding plans by provider", () => {
    const plans = [
      { ...validPlan, id: "cursor-pro", providerId: "cursor", productName: "Cursor" },
      { ...validPlan, id: "trae-pro", providerId: "trae", productName: "TRAE IDE" },
    ];

    expect(filterAndSortCodingPlans(plans, { providerId: "cursor" }).map((plan) => plan.id))
      .toEqual(["cursor-pro"]);
  });

  it("toggles up to three plan comparisons and sanitizes duplicates and unknown plans", () => {
    expect(toggleCodingPlanComparison(["a", "b", "c"], "d")).toEqual({
      ids: ["a", "b", "c"],
      limitReached: true,
    });
    expect(sanitizeCodingPlanComparisonIds(["unknown", "a", "a", "b", "c", "d"], [
      { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" },
    ])).toEqual({
      ids: ["a", "b", "c"],
      invalidCount: 1,
      overflowCount: 1,
      duplicatesRemoved: 1,
      normalizedChanged: true,
    });
    expect(sanitizeCodingPlanComparisonIds(["a", "b", "c", "d", "d"], [
      { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" },
    ])).toMatchObject({ overflowCount: 1, duplicatesRemoved: 1 });
  });
});
