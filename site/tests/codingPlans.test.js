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

  it("filters by coding surface and free plans before sorting by price", () => {
    const plans = [
      { ...validPlan, id: "paid-cli", productName: "Zeta", codingSurfaces: ["CLI"], price: { ...validPlan.price, amount: 10 } },
      { ...validPlan, id: "free-agent", productName: "Alpha", price: { ...validPlan.price, amount: 0 } },
      { ...validPlan, id: "free-ide", productName: "Beta", codingSurfaces: ["IDE"], price: { ...validPlan.price, amount: 0 } },
    ];

    expect(filterAndSortCodingPlans(plans, { surfaces: ["IDE"], freeOnly: true }).map((plan) => plan.id))
      .toEqual(["free-agent", "free-ide"]);
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
