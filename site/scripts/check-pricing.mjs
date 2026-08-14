import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { providers } from "../src/data/catalog.js";
import {
  assertSourceResult,
  buildSyncReport,
  extractPricingEvidence,
  fetchOfficialSource,
  fingerprint,
} from "./pricing-sync-core.mjs";

const defaultStatePath = fileURLToPath(new URL("../data/pricing-source-state.json", import.meta.url));
const defaultReportPath = fileURLToPath(new URL("../data/pricing-sync-report.md", import.meta.url));

function catalogSources() {
  return providers.map((provider) => ({
    providerId: provider.id,
    providerName: provider.name,
    pricingCheckMode: provider.pricingCheckMode ?? "automated",
    sourceUrl: provider.officialPricingUrl,
  }));
}

async function readState(statePath) {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid pricing source state");
    }
    return {
      checkedAt: parsed.checkedAt ?? "",
      pageSources: parsed.pageSources ?? parsed.sources ?? {},
      priceSources: parsed.priceSources ?? {},
    };
  } catch (error) {
    if (error.code === "ENOENT") return { checkedAt: "", pageSources: {}, priceSources: {} };
    throw error;
  }
}

function renderReport({ entries, fetchedAt }) {
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
    const status = entry.manualReviewRequired
      ? "需人工核对（定价页由客户端渲染）"
      : entry.baseline
      ? "价格信号基线已建立"
      : entry.priceChanged
        ? "价格信号已变更"
        : entry.pageChanged
          ? "页面内容已变更，价格信号未变"
          : "未变化";
    lines.push(`| ${entry.providerName} | ${entry.sourceUrl} | ${entry.priceFingerprint} | ${status} |`);
  }

  return `${lines.join("\n")}\n`;
}

export async function checkPricing({
  dryRun = false,
  fetchImpl = fetch,
  now = new Date().toISOString(),
  reportPath = defaultReportPath,
  sourceEntries = catalogSources(),
  statePath = defaultStatePath,
  timeoutMs = 15_000,
} = {}) {
  const priorState = await readState(statePath);
  const automatedEntries = sourceEntries.filter((entry) => entry.pricingCheckMode !== "manual");
  const manualEntries = sourceEntries
    .filter((entry) => entry.pricingCheckMode === "manual")
    .map((entry) => ({ ...entry, manualReviewRequired: true, pageChanged: false, priceChanged: false, baseline: false }));
  const fetched = await Promise.all(automatedEntries.map(async (entry) => {
    const content = await fetchOfficialSource(entry.sourceUrl, fetchImpl, { timeoutMs });
    assertSourceResult({ ...entry, content });
    let priceEvidence;
    try {
      priceEvidence = extractPricingEvidence(content);
    } catch (error) {
      throw new Error(`${entry.providerId}: ${error.message}`);
    }
    return {
      ...entry,
      pageFingerprint: fingerprint(content),
      priceFingerprint: fingerprint(priceEvidence),
    };
  }));

  const entries = [...fetched.map((entry) => ({
    ...entry,
    baseline: !priorState.priceSources[entry.sourceUrl],
    pageChanged: priorState.pageSources[entry.sourceUrl] !== entry.pageFingerprint,
    priceChanged: Boolean(priorState.priceSources[entry.sourceUrl])
      && priorState.priceSources[entry.sourceUrl] !== entry.priceFingerprint,
  })), ...manualEntries];
  const changed = entries.some((entry) => entry.baseline || entry.priceChanged);
  const report = renderReport(buildSyncReport(entries, now));
  const nextState = {
    checkedAt: now,
    pageSources: Object.fromEntries(fetched.map((entry) => [entry.sourceUrl, entry.pageFingerprint])),
    priceSources: Object.fromEntries(fetched.map((entry) => [entry.sourceUrl, entry.priceFingerprint])),
    sourceScope: "providers[].officialPricingUrl",
  };

  if (changed && !dryRun) {
    await Promise.all([mkdir(dirname(statePath), { recursive: true }), mkdir(dirname(reportPath), { recursive: true })]);
    await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
    await writeFile(reportPath, report);
  }

  return { changed, entries, report };
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
