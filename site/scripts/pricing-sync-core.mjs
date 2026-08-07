import { createHash } from "node:crypto";
import { providers } from "../src/data/catalog.js";

const officialHostByProvider = new Map(
  providers.map((provider) => [provider.id, new URL(provider.officialPricingUrl).hostname]),
);

export async function fetchOfficialSource(sourceUrl, fetchImpl = fetch) {
  try {
    if (new URL(sourceUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`invalid source URL: ${sourceUrl}`);
  }

  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`source request failed: ${sourceUrl}`);
  }

  return response.text();
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
