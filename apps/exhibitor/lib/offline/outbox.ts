import type { OutboxEntry } from "./types";

/**
 * Produces one newest local event per canonical QR token. Server-backed
 * tokens can be supplied to omit local events already reflected remotely.
 */
export function getLatestOutboxEntriesByQrToken(
  entries: OutboxEntry[],
  excludedQrTokens: Iterable<string> = [],
): OutboxEntry[] {
  const seen = new Set(Array.from(excludedQrTokens, (token) => token.trim()));
  const newestFirst = [...entries].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));

  return newestFirst.filter((entry) => {
    const qrToken = entry.qrToken.trim();
    if (seen.has(qrToken)) return false;
    seen.add(qrToken);
    return true;
  });
}
