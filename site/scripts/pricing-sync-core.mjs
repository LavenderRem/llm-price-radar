import { createHash } from "node:crypto";

export async function fetchOfficialSource(sourceUrl, fetchImpl = fetch) {
  if (!/^https:\/\//.test(sourceUrl)) {
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
  let hostname = "";

  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    // The invalid-source error below must include the provider id.
  }

  const providerDomain = `${providerId}.com`;

  if (!providerId || !hostname || (hostname !== providerDomain && !hostname.endsWith(`.${providerDomain}`)) || typeof content !== "string" || !content.trim()) {
    throw new Error(`invalid source: ${providerId}`);
  }
}

export const buildSyncReport = (entries, fetchedAt) => ({ entries, fetchedAt });
