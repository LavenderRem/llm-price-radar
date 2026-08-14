import { createHash } from "node:crypto";
import { providers } from "../src/data/catalog.js";

const officialHostsByProvider = new Map(
  providers.map((provider) => [
    provider.id,
    new Set([new URL(provider.officialPricingUrl).hostname]),
  ]),
);

export async function fetchOfficialSource(sourceUrl, fetchImpl = fetch, { timeoutMs = 15_000 } = {}) {
  try {
    if (new URL(sourceUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`invalid source URL: ${sourceUrl}`);
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`invalid source timeout: ${timeoutMs}`);
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`source request timed out after ${timeoutMs}ms: ${sourceUrl}`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([fetchImpl(sourceUrl, { signal: controller.signal }), timeout]);
    if (!response.ok) {
      throw new Error(`source request failed: ${sourceUrl} (HTTP ${response.status ?? "unknown"})`);
    }

    return await Promise.race([response.text(), timeout]);
  } catch (error) {
    if (timedOut) {
      throw new Error(`source request timed out after ${timeoutMs}ms: ${sourceUrl}`);
    }
    if (error instanceof Error && error.message.startsWith("source request failed:")) {
      throw error;
    }
    throw new Error(`source request failed: ${sourceUrl} (${error instanceof Error ? error.message : String(error)})`);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const fingerprint = (content) => createHash("sha256").update(content).digest("hex");

export function fingerprintCodingPlanFacts(plan) {
  return fingerprint(JSON.stringify({
    price: plan.price,
    annualPrice: plan.annualPrice,
    includedUsage: plan.includedUsage,
    allowancePolicy: plan.allowancePolicy,
    codingSurfaces: [...plan.codingSurfaces].sort(),
    officialUrl: plan.officialUrl,
  }));
}

export function extractPricingEvidence(content) {
  const visibleText = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:#0*36|#x0*24|dollar);/gi, "$")
    .replace(/&(?:#0*165|#x0*a5|yen);/gi, "¥");

  const lines = visibleText
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /(?:(?:\$|¥|￥)\s*\d|(?:USD|CNY|RMB)\s*\d|\d+\s*(?:元|美元|人民币))/i.test(line));

  if (lines.length === 0) {
    throw new Error("no pricing evidence found in official source");
  }

  return lines.join("\n");
}

export function assertSourceResult({ providerId, sourceUrl, content, officialHosts }) {
  let url;

  try {
    url = new URL(sourceUrl);
  } catch {
    // The invalid-source error below must include the provider id.
  }

  const permittedHosts = officialHosts ?? officialHostsByProvider.get(providerId);

  if (!providerId || !permittedHosts || !url || url.protocol !== "https:" || !permittedHosts.has(url.hostname) || typeof content !== "string" || !content.trim()) {
    throw new Error(`invalid source: ${providerId}`);
  }
}

export const buildSyncReport = (entries, fetchedAt) => ({ entries, fetchedAt });
