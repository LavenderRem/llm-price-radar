import { strict as assert } from "node:assert";
import test from "node:test";

import {
  assertSourceResult,
  fingerprint,
} from "../scripts/pricing-sync-core.mjs";

test("fingerprint changes when source content changes", () => {
  assert.notEqual(fingerprint("价格 2.00"), fingerprint("价格 3.00"));
});

test("assertSourceResult rejects an invalid source with its provider id", () => {
  assert.throws(
    () => assertSourceResult({ providerId: "openai", sourceUrl: "https://example.com", content: "x" }),
    /invalid source: openai/,
  );
});

test("assertSourceResult includes the provider id for a malformed HTTPS URL", () => {
  assert.throws(
    () => assertSourceResult({ providerId: "openai", sourceUrl: "https://", content: "x" }),
    /invalid source: openai/,
  );
});

test("assertSourceResult includes the provider id for missing content", () => {
  assert.throws(
    () => assertSourceResult({ providerId: "openai", sourceUrl: "https://openai.com" }),
    /invalid source: openai/,
  );
});
