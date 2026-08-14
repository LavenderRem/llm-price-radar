import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { providers } from "../src/data/catalog.js";
import { codingPlans } from "../src/data/codingPlans.js";
import {
  assertSourceResult,
  buildSyncReport,
  extractPricingEvidence,
  fetchOfficialSource,
  fingerprint,
  fingerprintCodingPlanFacts,
} from "./pricing-sync-core.mjs";

const defaultStatePath = fileURLToPath(new URL("../data/pricing-source-state.json", import.meta.url));
const defaultReportPath = fileURLToPath(new URL("../data/pricing-sync-report.md", import.meta.url));

function catalogSources() {
  return providers
    .filter((provider) => provider.catalogScope !== "coding-plans-only")
    .map((provider) => ({
      providerId: provider.id,
      providerName: provider.name,
      pricingCheckMode: provider.pricingCheckMode ?? "automated",
      sourceUrl: provider.officialPricingUrl,
    }));
}

const codingPlanSourceCheckPolicies = new Map([
  // CodeBuddy 的无人值守响应不提供可提取的套餐价格证据，改由人工核验以免超时或空证据阻断 API 日检。
  ["codebuddy", {
    pricingCheckMode: "manual",
    manualReviewReason: "官方页面未向无人值守请求提供可提取的套餐价格证据",
  }],
]);

export function codingPlanSources() {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));

  return codingPlans.map((plan) => {
    const provider = providerById.get(plan.providerId);
    const checkPolicy = codingPlanSourceCheckPolicies.get(plan.providerId);
    return {
      ...plan,
      providerName: provider.name,
      officialHosts: new Set([new URL(provider.officialPricingUrl).hostname, ...(provider.officialDomains ?? [])]),
      pricingCheckMode: checkPolicy?.pricingCheckMode ?? "automated",
      manualReviewReason: checkPolicy?.manualReviewReason,
    };
  });
}

async function readState(statePath) {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid pricing source state");
    }
    const legacyPriceSources = !Object.hasOwn(parsed, "priceSources") && parsed.sources && typeof parsed.sources === "object"
      ? parsed.sources
      : {};
    return {
      checkedAt: parsed.checkedAt ?? "",
      pageSources: parsed.pageSources ?? parsed.sources ?? {},
      priceSources: parsed.priceSources ?? {},
      legacyPriceSources,
      codingPlanPageSources: parsed.codingPlanPageSources ?? {},
      codingPlanPriceSources: parsed.codingPlanPriceSources ?? {},
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        checkedAt: "",
        pageSources: {},
        priceSources: {},
        legacyPriceSources: {},
        codingPlanPageSources: {},
        codingPlanPriceSources: {},
      };
    }
    throw error;
  }
}

function entryStatus(entry, { candidate = false } = {}) {
  if (entry.manualReviewRequired) return `需人工核验${entry.manualReviewReason ? `（${entry.manualReviewReason}）` : ""}`;
  if (entry.baseline) return candidate ? "候选价格基线已建立" : "价格信号基线已建立";
  if (entry.priceChanged) return candidate ? "候选价格变更" : "价格信号已变更";
  if (entry.pageChanged) return candidate ? "页面内容已变更，候选价格证据未变" : "页面内容已变更，价格信号未变";
  return "未变化";
}

function renderReport({ entries, codingPlanEntries, fetchedAt }) {
  const lines = [
    "# 每日服务商官方定价页检查报告",
    "",
    "检查对象：目录中每个服务商的官方定价页，每个服务商每天检查一次。",
    "",
    `检查时间：${fetchedAt}`,
    "",
    "| 服务商 | 官方定价页 | 价格信号指纹 | 结果 |",
    "| --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(`| ${entry.providerName} | ${entry.sourceUrl} | ${entry.priceFingerprint ?? "—"} | ${entryStatus(entry)} |`);
  }

  lines.push(
    "",
    "## 个人编程套餐",
    "",
    "检查对象：套餐目录的官方来源；官网价格证据变化仅作为候选变更，绝不自动改写套餐目录。",
    "",
    "| 产品 / 套餐 | 官方来源 | 目录关键事实指纹 | 价格证据指纹 | 结果 |",
    "| --- | --- | --- | --- | --- |",
  );

  for (const entry of codingPlanEntries.filter((item) => item.sourceRepresentative !== false)) {
    const planNames = entry.sourcePlanNames?.join("、") ?? entry.planName;
    lines.push(`| ${entry.productName} / ${planNames} | ${entry.sourceUrl} | ${entry.factsFingerprint} | ${entry.priceFingerprint ?? "—"} | ${entryStatus(entry, { candidate: true })} |`);
  }

  return `${lines.join("\n")}\n`;
}

export async function checkPricing({
  dryRun = false,
  fetchImpl = fetch,
  now = new Date().toISOString(),
  reportPath = defaultReportPath,
  sourceEntries = catalogSources(),
  codingPlanEntries = codingPlanSources(),
  statePath = defaultStatePath,
  timeoutMs = 15_000,
} = {}) {
  const priorState = await readState(statePath);
  const automatedEntries = sourceEntries.filter((entry) => entry.pricingCheckMode !== "manual");
  const manualEntries = sourceEntries
    .filter((entry) => entry.pricingCheckMode === "manual")
    .map((entry) => ({ ...entry, manualReviewRequired: true, pageChanged: false, priceChanged: false, baseline: false }));
  const evidenceBySourceUrl = new Map();
  const fetchPricingEvidence = async (entry) => {
    if (!evidenceBySourceUrl.has(entry.sourceUrl)) {
      evidenceBySourceUrl.set(entry.sourceUrl, (async () => {
        const content = await fetchOfficialSource(entry.sourceUrl, fetchImpl, { timeoutMs });
        let priceEvidence;
        try {
          priceEvidence = extractPricingEvidence(content);
        } catch (error) {
          throw new Error(`${entry.providerId}: ${error.message}`);
        }
        return {
          content,
          pageFingerprint: fingerprint(content),
          priceFingerprint: fingerprint(priceEvidence),
        };
      })());
    }

    const evidence = await evidenceBySourceUrl.get(entry.sourceUrl);
    assertSourceResult({ ...entry, content: evidence.content });
    return evidence;
  };
  const fetched = await Promise.all(automatedEntries.map(async (entry) => {
    const evidence = await fetchPricingEvidence(entry);
    return {
      ...entry,
      pageFingerprint: evidence.pageFingerprint,
      priceFingerprint: evidence.priceFingerprint,
    };
  }));

  const automatedCodingPlanEntries = codingPlanEntries.filter((entry) => entry.pricingCheckMode !== "manual");
  const manualCodingPlanEntries = codingPlanEntries
    .filter((entry) => entry.pricingCheckMode === "manual")
    .map((entry) => ({
      ...entry,
      factsFingerprint: fingerprintCodingPlanFacts(entry),
      manualReviewRequired: true,
      pageChanged: false,
      priceChanged: false,
      baseline: false,
    }));
  const codingPlanFetches = await Promise.all([...new Map(
    automatedCodingPlanEntries.map((entry) => [entry.sourceUrl, entry]),
  ).values()].map(async (entry) => {
    const evidence = await fetchPricingEvidence(entry);
    return [entry.sourceUrl, {
      pageFingerprint: evidence.pageFingerprint,
      priceFingerprint: evidence.priceFingerprint,
    }];
  }));
  const codingPlanFingerprintsByUrl = new Map(codingPlanFetches);

  const entries = [...fetched.map((entry) => {
    const hasLegacyPriceSource = Object.hasOwn(priorState.legacyPriceSources, entry.sourceUrl);
    return {
      ...entry,
      baseline: !priorState.priceSources[entry.sourceUrl] && !hasLegacyPriceSource,
      pageChanged: priorState.pageSources[entry.sourceUrl] !== entry.pageFingerprint,
      priceChanged: Boolean(priorState.priceSources[entry.sourceUrl])
        && priorState.priceSources[entry.sourceUrl] !== entry.priceFingerprint,
      legacyPriceBaseline: hasLegacyPriceSource,
    };
  }), ...manualEntries];
  const seenCodingPlanSources = new Set();
  const checkedCodingPlanEntries = automatedCodingPlanEntries.map((entry) => {
    const fingerprints = codingPlanFingerprintsByUrl.get(entry.sourceUrl);
    const sourceRepresentative = !seenCodingPlanSources.has(entry.sourceUrl);
    seenCodingPlanSources.add(entry.sourceUrl);
    const sourcePlanNames = automatedCodingPlanEntries
      .filter((plan) => plan.sourceUrl === entry.sourceUrl)
      .map((plan) => plan.planName);
    const priceChanged = sourceRepresentative
      && Boolean(priorState.codingPlanPriceSources[entry.sourceUrl])
      && priorState.codingPlanPriceSources[entry.sourceUrl] !== fingerprints.priceFingerprint;
    return {
      ...entry,
      ...fingerprints,
      factsFingerprint: fingerprintCodingPlanFacts(entry),
      sourceRepresentative,
      sourcePlanNames,
      baseline: sourceRepresentative && !priorState.codingPlanPriceSources[entry.sourceUrl],
      pageChanged: priorState.codingPlanPageSources[entry.sourceUrl] !== fingerprints.pageFingerprint,
      priceChanged,
      candidateChange: priceChanged,
    };
  });
  const checkedCodingPlanEntriesWithManual = [...checkedCodingPlanEntries, ...manualCodingPlanEntries];
  const changed = [...entries, ...checkedCodingPlanEntriesWithManual].some((entry) => entry.baseline || entry.priceChanged);
  const legacyPriceMigrationRequired = entries.some((entry) => entry.legacyPriceBaseline);
  const report = renderReport({
    ...buildSyncReport(entries, now),
    codingPlanEntries: checkedCodingPlanEntriesWithManual,
  });
  const nextState = {
    checkedAt: now,
    pageSources: Object.fromEntries(fetched.map((entry) => [entry.sourceUrl, entry.pageFingerprint])),
    priceSources: Object.fromEntries(fetched.map((entry) => [entry.sourceUrl, entry.priceFingerprint])),
    codingPlanPageSources: Object.fromEntries(codingPlanFetches.map(([sourceUrl, fingerprints]) => [sourceUrl, fingerprints.pageFingerprint])),
    codingPlanPriceSources: Object.fromEntries(codingPlanFetches.map(([sourceUrl, fingerprints]) => [sourceUrl, fingerprints.priceFingerprint])),
    sourceScope: "providers[].officialPricingUrl",
  };

  if ((changed || legacyPriceMigrationRequired) && !dryRun) {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  }

  if (changed && !dryRun) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, report);
  }

  return { changed, entries, codingPlanEntries: checkedCodingPlanEntriesWithManual, report };
}

async function runCli() {
  const result = await checkPricing({ dryRun: process.argv.includes("--dry-run") });
  process.stdout.write(result.report);
  process.stdout.write(`价格信号${result.changed ? "已变更或已建立基线" : "未变更"}${process.argv.includes("--dry-run") ? "（试运行）" : ""}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
