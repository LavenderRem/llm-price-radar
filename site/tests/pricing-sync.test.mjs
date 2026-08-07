import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertSourceResult,
  buildSyncReport,
  fetchOfficialSource,
  fingerprint,
} from "../scripts/pricing-sync-core.mjs";
import { models, providers } from "../src/data/catalog.js";

const fixturePath = new URL("./fixtures/openai-pricing.md", import.meta.url);

test("fingerprint changes when source content changes", () => {
  assert.notEqual(fingerprint("价格 2.00"), fingerprint("价格 3.00"));
});

test("assertSourceResult rejects an invalid source with its provider id", () => {
  assert.throws(
    () => assertSourceResult({ providerId: "openai", sourceUrl: "https://example.com", content: "x" }),
    /invalid source: openai/,
  );
});

test("assertSourceResult rejects HTTP sources with its provider id", () => {
  assert.throws(
    () => assertSourceResult({ providerId: "openai", sourceUrl: "http://developers.openai.com/pricing", content: "x" }),
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

test("assertSourceResult accepts every current catalog pricing source", () => {
  const content = "offline fixture";
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));

  for (const provider of providers) {
    assert.doesNotThrow(() => assertSourceResult({
      providerId: provider.id,
      sourceUrl: provider.officialPricingUrl,
      content,
    }));
  }

  for (const model of models) {
    for (const price of model.pricing) {
      assert.doesNotThrow(() => assertSourceResult({
        providerId: model.providerId,
        sourceUrl: price.sourceUrl,
        content,
      }));
      assert.equal(new URL(price.sourceUrl).hostname, new URL(providerById.get(model.providerId).officialPricingUrl).hostname);
    }
  }
});

test("fetchOfficialSource returns fixture content for a successful HTTPS response", async () => {
  const content = await readFile(fixturePath, "utf8");
  const result = await fetchOfficialSource("https://developers.openai.com/api/docs/pricing", async () => ({
    ok: true,
    text: async () => content,
  }));

  assert.equal(result, content);
});

test("fetchOfficialSource rejects non-success responses", async () => {
  await assert.rejects(
    fetchOfficialSource("https://developers.openai.com/api/docs/pricing", async () => ({ ok: false })),
    /source request failed: https:\/\/developers\.openai\.com\/api\/docs\/pricing/,
  );
});

test("fetchOfficialSource rejects HTTP sources", async () => {
  await assert.rejects(
    fetchOfficialSource("http://developers.openai.com/api/docs/pricing", async () => ({ ok: true })),
    /invalid source URL: http:\/\/developers\.openai\.com\/api\/docs\/pricing/,
  );
});

test("fetchOfficialSource rejects malformed HTTPS sources", async () => {
  await assert.rejects(
    fetchOfficialSource("https://", async () => ({ ok: true })),
    /invalid source URL: https:\/\//,
  );
});

test("buildSyncReport returns the entries with their fetch timestamp", () => {
  const entries = [{ providerId: "openai", fingerprint: "abc" }];
  const fetchedAt = "2026-08-07T00:00:00.000Z";

  assert.deepEqual(buildSyncReport(entries, fetchedAt), { entries, fetchedAt });
});
