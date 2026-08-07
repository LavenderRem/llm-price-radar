import { createHash } from "node:crypto";
import { providers } from "../src/data/catalog.js";

const officialHostByProvider = new Map(
  providers.map((provider) => [provider.id, new URL(provider.officialPricingUrl).hostname]),
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

export function assertSourceResult({ providerId, sourceUrl, content }) {
  let url;

  try {
    url = new URL(sourceUrl);
  } catch {
    // The invalid-source error below must include the provider id.
  }

  const officialHost = officialHostByProvider.get(providerId);

  if (!providerId || !officialHost || !url || url.protocol !== "https:" || url.hostname !== officialHost || typeof content !== "string" || !content.trim()) {
    throw new Error(`invalid source: ${providerId}`);
  }
}

export const buildSyncReport = (entries, fetchedAt) => ({ entries, fetchedAt });
