import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertSourceResult,
  buildSyncReport,
  extractPricingEvidence,
  fetchOfficialSource,
  fingerprint,
  fingerprintCodingPlanFacts,
} from "../scripts/pricing-sync-core.mjs";
import { checkPricing, codingPlanSources } from "../scripts/check-pricing.mjs";
import { models, providers } from "../src/data/catalog.js";
import { codingPlans } from "../src/data/codingPlans.js";

const fixturePath = new URL("./fixtures/openai-pricing.md", import.meta.url);

test("fingerprint changes when source content changes", () => {
  assert.notEqual(fingerprint("价格 2.00"), fingerprint("价格 3.00"));
});

test("pricing evidence ignores marketing-only pricing copy", () => {
  assert.throws(
    () => extractPricingEvidence("<p>Pricing for professional teams</p>"),
    /no pricing evidence found/,
  );
});

test("pricing evidence joins an amount and its currency split across adjacent nodes", () => {
  assert.match(
    extractPricingEvidence("<div><span>12</span><span>元</span></div>"),
    /12 元/,
  );
});

test("pricing evidence keeps a price when an empty layout span separates its currency", () => {
  assert.match(
    extractPricingEvidence("<p>12<span class=\"help-letter-space\"></span>元</p>"),
    /12 元/,
  );
});

test("coding plan catalog fingerprint ignores copy but changes for price facts", () => {
  const current = {
    id: "cursor-pro",
    price: { amount: 20, currency: "USD", period: "month" },
    includedUsage: "官方额度",
    allowancePolicy: { label: "按官方规则" },
    codingSurfaces: ["IDE"],
    officialUrl: "https://cursor.com/pricing",
  };

  assert.equal(
    fingerprintCodingPlanFacts({ ...current, officialSummary: "新版营销文案" }),
    fingerprintCodingPlanFacts(current),
  );
  assert.notEqual(
    fingerprintCodingPlanFacts({ ...current, price: { ...current.price, amount: 25 } }),
    fingerprintCodingPlanFacts(current),
  );
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

test("every provider's daily source points to its declared pricing page", () => {
  for (const provider of providers) {
    assert.match(provider.officialPricingUrl, /pricing/i, `${provider.id} must use a pricing source`);
  }
});

test("Anthropic pricing sources use the current canonical docs host", () => {
  const canonicalUrl = "https://platform.claude.com/docs/en/about-claude/pricing";
  const anthropic = providers.find((provider) => provider.id === "anthropic");

  assert.equal(anthropic.officialPricingUrl, canonicalUrl);
  for (const model of models.filter((item) => item.providerId === "anthropic")) {
    for (const price of model.pricing) assert.equal(price.sourceUrl, canonicalUrl);
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
    fetchOfficialSource("https://developers.openai.com/api/docs/pricing", async () => ({ ok: false, status: 503 })),
    /source request failed: https:\/\/developers\.openai\.com\/api\/docs\/pricing \(HTTP 503\)/,
  );
});

test("fetchOfficialSource identifies the official URL for network failures", async () => {
  await assert.rejects(
    fetchOfficialSource(
      "https://developers.openai.com/api/docs/pricing",
      async () => { throw new Error("socket unavailable"); },
    ),
    /source request failed: https:\/\/developers\.openai\.com\/api\/docs\/pricing \(socket unavailable\)/,
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

const cursorPlanSource = {
  id: "cursor-pro",
  providerId: "cursor",
  providerName: "Cursor",
  productName: "Cursor",
  planName: "Pro",
  price: { amount: 20, currency: "USD", period: "month" },
  includedUsage: "官方额度",
  allowancePolicy: { status: "published", label: "按官方规则" },
  codingSurfaces: ["IDE"],
  officialUrl: "https://cursor.com/pricing",
  sourceUrl: "https://cursor.com/pricing",
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
      fetchImpl: async () => ({ ok: true, text: async () => "current official price $20" }),
      now: "2026-08-07T00:00:00.000Z",
      sourceEntries: [openAiSource],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, true);
    assert.match(result.report, /OpenAI/);
    assert.match(await readFile(reportPath, "utf8"), /OpenAI/);
    assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
      checkedAt: "2026-08-07T00:00:00.000Z",
      pageSources: {
        [openAiSource.sourceUrl]: result.entries[0].pageFingerprint,
      },
      priceSources: {
        [openAiSource.sourceUrl]: result.entries[0].priceFingerprint,
      },
      codingPlanPageSources: {},
      codingPlanPriceSources: {},
      sourceScope: "providers[].officialPricingUrl",
    });
  });
});

test("checkPricing excludes coding-plans-only providers from default model API sources", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const requestedUrls = [];
    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async (sourceUrl) => {
        requestedUrls.push(sourceUrl);
        return { ok: true, text: async () => "current official price $20" };
      },
      now: "2026-08-07T00:00:00.000Z",
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    const codingPlansOnlyProviders = providers.filter((provider) => provider.catalogScope === "coding-plans-only");
    const defaultProviders = providers.filter((provider) => provider.catalogScope !== "coding-plans-only");

    assert.deepEqual(codingPlansOnlyProviders.map((provider) => provider.id).sort(), ["codebuddy", "cursor", "trae"]);
    assert.deepEqual(
      requestedUrls.sort(),
      defaultProviders.filter((provider) => provider.pricingCheckMode !== "manual").map((provider) => provider.officialPricingUrl).sort(),
    );
    assert.deepEqual(result.entries.map((entry) => entry.sourceUrl).sort(), defaultProviders.map((provider) => provider.officialPricingUrl).sort());
  });
});

test("coding plan source changes are reported as candidates without changing the catalog", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const catalogPath = new URL("../src/data/codingPlans.js", import.meta.url);
    const catalogBefore = await readFile(catalogPath, "utf8");
    await writeFile(statePath, `${JSON.stringify({
      codingPlanPageSources: { [cursorPlanSource.sourceUrl]: fingerprint("Pro $20/month") },
      codingPlanPriceSources: { [cursorPlanSource.sourceUrl]: fingerprint(extractPricingEvidence("Pro $20/month")) },
    })}\n`);

    const result = await checkPricing({
      dryRun: true,
      codingPlanEntries: [cursorPlanSource],
      fetchImpl: async () => ({ ok: true, text: async () => "Pro $25/month" }),
      now: "2026-08-14T00:00:00.000Z",
      reportPath,
      sourceEntries: [],
      statePath,
    });

    assert.equal(result.codingPlanEntries[0].priceChanged, true);
    assert.equal(result.codingPlanEntries[0].candidateChange, true);
    assert.match(result.report, /个人编程套餐/);
    assert.match(result.report, /候选价格变更/);
    assert.equal(await readFile(catalogPath, "utf8"), catalogBefore);
    assert.equal((await readFile(statePath, "utf8")).includes("codingPlanPriceSources"), true);
    await assert.rejects(readFile(reportPath, "utf8"), { code: "ENOENT" });
  });
});

test("coding plan sources fetch each shared official URL once", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const requestedUrls = [];
    const result = await checkPricing({
      dryRun: true,
      codingPlanEntries: [cursorPlanSource, { ...cursorPlanSource, id: "cursor-free", planName: "Free" }],
      fetchImpl: async (sourceUrl) => {
        requestedUrls.push(sourceUrl);
        return { ok: true, text: async () => "Pro $20/month" };
      },
      sourceEntries: [],
      statePath,
      reportPath,
    });

    assert.deepEqual(requestedUrls, [cursorPlanSource.sourceUrl]);
    assert.equal(result.codingPlanEntries.length, 2);
  });
});

test("a shared coding plan source reports one source candidate instead of every tier", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    await writeFile(statePath, `${JSON.stringify({
      codingPlanPageSources: { [cursorPlanSource.sourceUrl]: fingerprint("Cursor Pro $20/month") },
      codingPlanPriceSources: { [cursorPlanSource.sourceUrl]: fingerprint(extractPricingEvidence("Cursor Pro $20/month")) },
    })}\n`);

    const result = await checkPricing({
      dryRun: true,
      codingPlanEntries: [cursorPlanSource, { ...cursorPlanSource, id: "cursor-free", planName: "Free" }],
      fetchImpl: async () => ({ ok: true, text: async () => "Cursor Pro $25/month" }),
      sourceEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.codingPlanEntries.filter((entry) => entry.candidateChange).length, 1);
    assert.match(result.report, /Cursor \/ Pro、Free/);
  });
});

test("a shared official source feeds model and coding plan checks once", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const requestedUrls = [];
    await checkPricing({
      dryRun: true,
      codingPlanEntries: [cursorPlanSource],
      fetchImpl: async (sourceUrl) => {
        requestedUrls.push(sourceUrl);
        return { ok: true, text: async () => "Pro $20/month" };
      },
      sourceEntries: [{ providerId: "cursor", providerName: "Cursor", sourceUrl: cursorPlanSource.sourceUrl }],
      statePath,
      reportPath,
    });

    assert.deepEqual(requestedUrls, [cursorPlanSource.sourceUrl]);
  });
});

test("a failed automated coding plan source leaves state and report untouched", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const originalState = '{"sources":{"https://existing.example":"unchanged"}}\n';
    const originalReport = "# Existing report\n";
    await writeFile(statePath, originalState);
    await writeFile(reportPath, originalReport);

    await assert.rejects(
      checkPricing({
        codingPlanEntries: [cursorPlanSource],
        fetchImpl: async () => ({ ok: false, status: 503 }),
        sourceEntries: [],
        statePath,
        reportPath,
      }),
      /source request failed/,
    );

    assert.equal(await readFile(statePath, "utf8"), originalState);
    assert.equal(await readFile(reportPath, "utf8"), originalReport);
  });
});

test("CodeBuddy coding plan sources are explicitly manual and only request human verification", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const codeBuddySources = codingPlanSources().filter((entry) => entry.providerId === "codebuddy");
    const result = await checkPricing({
      dryRun: true,
      codingPlanEntries: codeBuddySources,
      fetchImpl: async () => { throw new Error("manual source must not be fetched"); },
      sourceEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(codeBuddySources.every((entry) => entry.pricingCheckMode === "manual"), true);
    assert.equal(result.codingPlanEntries.every((entry) => entry.manualReviewRequired), true);
    assert.match(result.report, /需人工核验/);
    assert.match(result.report, /未向无人值守请求提供可提取的套餐价格证据/);
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
        codingPlanEntries: [],
        statePath,
        reportPath,
      }),
      /source request failed/,
    );

    assert.equal(await readFile(statePath, "utf8"), originalState);
    assert.equal(await readFile(reportPath, "utf8"), originalReport);
  });
});

test("checkPricing aborts timed out source requests without changing persistent files", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const originalState = '{"sources":{"https://existing.example":"unchanged"}}\n';
    const originalReport = "# Existing report\n";
    await writeFile(statePath, originalState);
    await writeFile(reportPath, originalReport);

    await assert.rejects(
      checkPricing({
        fetchImpl: async (_sourceUrl, { signal } = {}) => new Promise((_, reject) => {
          const fallback = setTimeout(() => reject(new Error("fetch did not receive an abort signal")), 25);
          signal?.addEventListener("abort", () => {
            clearTimeout(fallback);
            reject(signal.reason);
          }, { once: true });
        }),
        now: "2026-08-07T00:00:00.000Z",
        sourceEntries: [openAiSource],
        codingPlanEntries: [],
        statePath,
        reportPath,
        timeoutMs: 5,
      }),
      /source request timed out after 5ms/,
    );

    assert.equal(await readFile(statePath, "utf8"), originalState);
    assert.equal(await readFile(reportPath, "utf8"), originalReport);
  });
});

test("checkPricing dry run detects a change without persisting files", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async () => ({ ok: true, text: async () => "current official price $20" }),
      now: "2026-08-07T00:00:00.000Z",
      sourceEntries: [openAiSource],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, true);
    await assert.rejects(readFile(statePath, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(reportPath, "utf8"), { code: "ENOENT" });
  });
});

test("checkPricing ignores dynamic page content when the extracted pricing evidence is unchanged", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const sourceUrl = "https://developers.openai.com/api/docs/pricing";
    const priorContent = '<main><p>Input $2.00 per 1M tokens</p><script>build=1</script></main>';
    await writeFile(statePath, `${JSON.stringify({
      priceSources: { [sourceUrl]: fingerprint(extractPricingEvidence(priorContent)) },
      checkedAt: "2026-08-12T00:00:00.000Z",
    })}\n`);

    const result = await checkPricing({
      fetchImpl: async () => ({ ok: true, text: async () => '<main><p>Input $2.00 per 1M tokens</p><script>build=2</script></main>' }),
      now: "2026-08-13T00:00:00.000Z",
      sourceEntries: [{ providerId: "openai", providerName: "OpenAI", sourceUrl }],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, false);
    assert.equal(result.entries[0].priceChanged, false);
    assert.equal(result.entries[0].pageChanged, true);
    await assert.rejects(readFile(reportPath, "utf8"), { code: "ENOENT" });
  });
});

test("checkPricing migrates legacy source state without reporting an API price change", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const sourceUrl = "https://developers.openai.com/api/docs/pricing";
    await writeFile(statePath, `${JSON.stringify({
      checkedAt: "2026-08-13T03:28:13.210Z",
      sources: { [sourceUrl]: fingerprint("legacy full page fingerprint") },
      sourceScope: "providers[].officialPricingUrl",
    })}\n`);

    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async () => ({ ok: true, text: async () => "Input $3.00 per 1M tokens" }),
      now: "2026-08-14T00:00:00.000Z",
      sourceEntries: [{ providerId: "openai", providerName: "OpenAI", sourceUrl }],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.entries[0].baseline, false);
    assert.equal(result.entries[0].priceChanged, false);
    assert.equal(result.changed, false);
    await assert.rejects(readFile(reportPath, "utf8"), { code: "ENOENT" });
  });
});

test("checkPricing persists a legacy price baseline without a report and detects the next real change", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const sourceUrl = "https://developers.openai.com/api/docs/pricing";
    const sourceEntry = { providerId: "openai", providerName: "OpenAI", sourceUrl };
    const originalReport = "# Existing report\n";
    await writeFile(statePath, `${JSON.stringify({
      sources: { [sourceUrl]: fingerprint("legacy full page fingerprint") },
    })}\n`);
    await writeFile(reportPath, originalReport);

    const migration = await checkPricing({
      fetchImpl: async () => ({ ok: true, text: async () => "Input $3.00 per 1M tokens" }),
      sourceEntries: [sourceEntry],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(migration.changed, false);
    assert.equal(JSON.parse(await readFile(statePath, "utf8")).priceSources[sourceUrl], fingerprint("Input $3.00 per 1M tokens"));
    assert.equal(await readFile(reportPath, "utf8"), originalReport);

    const nextCheck = await checkPricing({
      fetchImpl: async () => ({ ok: true, text: async () => "Input $4.00 per 1M tokens" }),
      sourceEntries: [sourceEntry],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(nextCheck.entries[0].priceChanged, true);
    assert.equal(nextCheck.changed, true);
  });
});

test("checkPricing reports a changed pricing evidence fingerprint", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const sourceUrl = "https://developers.openai.com/api/docs/pricing";
    await writeFile(statePath, `${JSON.stringify({
      priceSources: { [sourceUrl]: fingerprint(extractPricingEvidence("Input $2.00 per 1M tokens")) },
      checkedAt: "2026-08-12T00:00:00.000Z",
    })}\n`);

    const result = await checkPricing({
      fetchImpl: async () => ({ ok: true, text: async () => "Input $3.00 per 1M tokens" }),
      now: "2026-08-13T00:00:00.000Z",
      sourceEntries: [{ providerId: "openai", providerName: "OpenAI", sourceUrl }],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, true);
    assert.equal(result.entries[0].priceChanged, true);
    assert.match(await readFile(reportPath, "utf8"), /价格信号已变更/);
  });
});

test("checkPricing identifies the provider when a source contains no pricing evidence", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    await assert.rejects(
      checkPricing({
        fetchImpl: async () => ({ ok: true, text: async () => "welcome" }),
        sourceEntries: [{ providerId: "openai", providerName: "OpenAI", sourceUrl: "https://developers.openai.com/api/docs/pricing" }],
        codingPlanEntries: [],
        statePath,
        reportPath,
      }),
      /openai: no pricing evidence found in official source/,
    );
  });
});

test("checkPricing retries a source when the first response has no pricing evidence", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    let attempts = 0;
    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async () => ({
        ok: true,
        text: async () => (++attempts === 1 ? "welcome" : "Input $2.00 per 1M tokens"),
      }),
      sourceEntries: [{ providerId: "openai", providerName: "OpenAI", sourceUrl: "https://developers.openai.com/api/docs/pricing" }],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(attempts, 2);
    assert.equal(result.entries[0].providerId, "openai");
  });
});

test("checkPricing reports client-rendered pricing sources for manual review without fetching them", async () => {
  await withTemporaryPaths(async ({ statePath, reportPath }) => {
    const result = await checkPricing({
      dryRun: true,
      fetchImpl: async () => { throw new Error("manual source must not be fetched"); },
      sourceEntries: [{
        providerId: "zhipu",
        providerName: "智谱开放平台",
        sourceUrl: "https://open.bigmodel.cn/pricing",
        pricingCheckMode: "manual",
      }],
      codingPlanEntries: [],
      statePath,
      reportPath,
    });

    assert.equal(result.changed, false);
    assert.equal(result.entries[0].manualReviewRequired, true);
    assert.match(result.report, /需人工核验/);
  });
});

test("daily pricing workflow schedules checks and opens a pull request", async () => {
  const workflowPath = new URL("../../.github/workflows/daily-pricing-update.yml", import.meta.url);
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron:\s*["']0 1 \* \* \*["']/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /id:\s*pricing_check/);
  assert.match(workflow, /npm run pricing:check/);
  assert.match(workflow, /peter-evans\/create-pull-request@v7/);
  assert.match(workflow, /if:\s*steps\.pricing_check\.outputs\.changed\s*==\s*['"]true['"]/);
  assert.match(workflow, /base:\s*codex\/model-price-site/);
  assert.doesNotMatch(workflow, /auto-merge|gh pr merge|deploy/i);
});

test("GitHub Pages workflow builds and deploys the static client after a base-branch update", async () => {
  const workflowPath = new URL("../../.github/workflows/deploy-github-pages.yml", import.meta.url);
  const workflow = await readFile(workflowPath, "utf8");
  const viteConfig = await readFile(new URL("../vite.config.mjs", import.meta.url), "utf8");

  assert.match(workflow, /push:/);
  assert.match(workflow, /codex\/model-price-site/);
  assert.match(workflow, /npm run build --prefix site/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /path:\s*site\/dist\/client/);
  assert.match(viteConfig, /GITHUB_ACTIONS/);
  assert.match(viteConfig, /llm-price-radar/);
});
