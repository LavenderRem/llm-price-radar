import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertSourceResult,
  buildSyncReport,
  fetchOfficialSource,
  fingerprint,
} from "../scripts/pricing-sync-core.mjs";
import { checkPricing } from "../scripts/check-pricing.mjs";
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

const openAiSource = {
  providerId: "openai",
  providerName: "OpenAI",
  sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
};

async function withTemporaryPaths(run) {
  const directory = await mkdtemp(join(tmpdir(), "llm-price-check-"));
  const paths = {
    statePath: join(directory, "pricing-source-state.json"),
    reportPath: join(directory, "pricing-sync-report.md"),
  };

  try {
    await run(paths);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("checkPricing persists a changed official source and its report", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const result = await checkPricing({
      fetchImpl: async () => ({ ok: true, text: async () => "current official price" }),
      now: "2026-08-07T00:00:00.000Z",
      sourceEntries: [openAiSource],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, true);
    assert.match(result.report, /OpenAI/);
    assert.match(await readFile(reportPath, "utf8"), /OpenAI/);
    assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
      sources: {
        [openAiSource.sourceUrl]: result.entries[0].fingerprint,
      },
    });
  });
});

test("checkPricing leaves persistent files unchanged when a source request fails", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const originalState = '{"sources":{"https://existing.example":"unchanged"}}\n';
    const originalReport = "# Existing report\n";
    await writeFile(statePath, originalState);
    await writeFile(reportPath, originalReport);

    await assert.rejects(
      checkPricing({
        fetchImpl: async () => ({ ok: false }),
        now: "2026-08-07T00:00:00.000Z",
        sourceEntries: [openAiSource],
        statePath,
        reportPath,
      }),
      /source request failed/,
    );

    assert.equal(await readFile(statePath, "utf8"), originalState);
    assert.equal(await readFile(reportPath, "utf8"), originalReport);
  });
});

test("checkPricing dry run detects a change without persisting files", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async () => ({ ok: true, text: async () => "current official price" }),
      now: "2026-08-07T00:00:00.000Z",
      sourceEntries: [openAiSource],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, true);
    await assert.rejects(readFile(statePath, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(reportPath, "utf8"), { code: "ENOENT" });
  });
});
