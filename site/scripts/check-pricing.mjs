import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { models, providers } from "../src/data/catalog.js";
import {
  assertSourceResult,
  buildSyncReport,
  fetchOfficialSource,
  fingerprint,
} from "./pricing-sync-core.mjs";

const defaultStatePath = fileURLToPath(new URL("../data/pricing-source-state.json", import.meta.url));
const defaultReportPath = fileURLToPath(new URL("../data/pricing-sync-report.md", import.meta.url));

function catalogSources() {
  const providerNameById = new Map(providers.map((provider) => [provider.id, provider.name]));
  const sources = new Map();

  for (const model of models) {
    for (const price of model.pricing) {
      if (!sources.has(price.sourceUrl)) {
        sources.set(price.sourceUrl, {
          providerId: model.providerId,
          providerName: providerNameById.get(model.providerId),
          sourceUrl: price.sourceUrl,
        });
      }
    }
  }

  return [...sources.values()];
}

async function readState(statePath) {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed.sources || typeof parsed.sources !== "object" || Array.isArray(parsed.sources)) {
      throw new Error("invalid pricing source state");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return { sources: {} };
    throw error;
  }
}

function renderReport({ entries, fetchedAt }) {
  const lines = [
    "# 每日价格来源检查报告",
    "",
    `检查时间：${fetchedAt}`,
    "",
    "| 服务商 | 官方来源 | 内容指纹 | 状态 |",
    "| --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(`| ${entry.providerName} | ${entry.sourceUrl} | ${entry.fingerprint} | ${entry.changed ? "已变化" : "未变化"} |`);
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
} = {}) {
  const priorState = await readState(statePath);
  const fetched = await Promise.all(sourceEntries.map(async (entry) => {
    const content = await fetchOfficialSource(entry.sourceUrl, fetchImpl);
    assertSourceResult({ ...entry, content });
    return { ...entry, fingerprint: fingerprint(content) };
  }));

  const entries = fetched.map((entry) => ({
    ...entry,
    changed: priorState.sources[entry.sourceUrl] !== entry.fingerprint,
  }));
  const changed = entries.some((entry) => entry.changed);
  const report = renderReport(buildSyncReport(entries, now));
  const nextState = {
    sources: Object.fromEntries(entries.map((entry) => [entry.sourceUrl, entry.fingerprint])),
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
  process.stdout.write(`价格来源${result.changed ? "已变化" : "未变化"}${process.argv.includes("--dry-run") ? "（试运行）" : ""}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
