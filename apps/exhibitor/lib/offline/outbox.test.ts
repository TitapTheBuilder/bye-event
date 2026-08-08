import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "./types";
import { getLatestOutboxEntriesByQrToken } from "./outbox";

function entry(localId: string, qrToken: string, scannedAt: string): OutboxEntry {
  return { localId, qrToken, scannedAt, synced: false };
}

describe("getLatestOutboxEntriesByQrToken", () => {
  it("keeps only the newest local scan for each QR token", () => {
    const result = getLatestOutboxEntriesByQrToken([
      entry("older", "tok-1", "2026-01-01T10:00:00.000Z"),
      entry("newer", "tok-1", "2026-01-01T11:00:00.000Z"),
    ]);

    expect(result.map((item) => item.localId)).toEqual(["newer"]);
  });

  it("normalizes tokens and omits entries already represented by the server", () => {
    const result = getLatestOutboxEntriesByQrToken(
      [
        entry("duplicate", "  tok-1\n", "2026-01-01T11:00:00.000Z"),
        entry("local", "tok-2", "2026-01-01T10:00:00.000Z"),
      ],
      ["tok-1"],
    );

    expect(result.map((item) => item.localId)).toEqual(["local"]);
  });
});
