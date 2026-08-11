"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/client/auth-context";
import {
  addOutboxEntry,
  getAllOutboxEntries,
  getCachedVisitor,
  removeOutboxEntriesByQrToken,
} from "@/lib/offline/idb";
import { getLatestOutboxEntriesByQrToken } from "@/lib/offline/outbox";
import { syncEngine } from "@/lib/offline/sync-engine";

export interface ScannedListItem {
  key: string;
  qrToken: string;
  visitorId?: string;
  localId?: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType?: "invited" | "guest";
  scannedAt: string;
  syncState: "synced" | "pending" | "sync-error";
}

interface ServerVisitRow {
  visitorId: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType: "invited" | "guest";
  qrToken: string;
  shortCode: string | null;
  scanCount: number;
  lastScannedAt: string;
  createdAt: string;
}

export function useScannedList() {
  const { exhibitor } = useAuth();
  const [items, setItems] = useState<ScannedListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const seenQrTokens = new Set<string>();
      const merged: ScannedListItem[] = [];

      if (exhibitor) {
        try {
          const res = await fetch(`/api/visits?q=${encodeURIComponent(search)}`);
          if (res.ok) {
            const data = (await res.json()) as { visits: ServerVisitRow[] };
            for (const row of data.visits) {
              seenQrTokens.add(row.qrToken.trim());
              if (row.shortCode) seenQrTokens.add(row.shortCode.trim());
              merged.push({
                key: row.visitorId,
                qrToken: row.qrToken,
                visitorId: row.visitorId,
                firstName: row.firstName,
                lastName: row.lastName,
                company: row.company,
                phoneNumber: row.phoneNumber,
                email: row.email,
                visitorType: row.visitorType,
                scannedAt: row.lastScannedAt,
                syncState: "synced",
              });
            }
          }
        } catch {
          // Offline despite being "authenticated" -- fall through to local
          // outbox data below so the list still renders something.
        }
      }

      // Always fold in local outbox entries not yet reflected server-side
      // (or all of them, when signed out/offline) -- scans made seconds
      // ago must show up immediately, not just after a successful sync.
      const outbox = getLatestOutboxEntriesByQrToken(await getAllOutboxEntries(), seenQrTokens);
      for (const entry of outbox) {
        const qrToken = entry.qrToken.trim();
        seenQrTokens.add(qrToken);
        const cached =
          (await getCachedVisitor(qrToken)) ??
          (qrToken === entry.qrToken ? undefined : await getCachedVisitor(entry.qrToken));
        merged.push({
          key: `local:${entry.localId}`,
          qrToken,
          localId: entry.localId,
          firstName: cached?.firstName ?? null,
          lastName: cached?.lastName ?? null,
          company: cached?.company ?? null,
          phoneNumber: cached?.phoneNumber ?? null,
          email: cached?.email ?? null,
          visitorType: cached?.visitorType,
          scannedAt: entry.scannedAt,
          syncState: entry.synced ? "synced" : entry.permanentError ? "sync-error" : "pending",
        });
      }

      const filtered = search
        ? merged.filter((item) => {
            const haystack =
              `${item.firstName ?? ""} ${item.lastName ?? ""} ${item.company ?? ""}`.toLowerCase();
            return haystack.includes(search.toLowerCase());
          })
        : merged;

      filtered.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
      setItems(filtered);
    } finally {
      setIsLoading(false);
    }
  }, [exhibitor, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the list fresh as the sync engine does its work in the background.
  useEffect(() => syncEngine.subscribe(() => void load()), [load]);

  const remove = useCallback(
    async (item: ScannedListItem): Promise<() => Promise<void>> => {
      setItems((prev) => prev.filter((i) => i.key !== item.key));

      if (item.visitorId) {
        await fetch(`/api/visits/${item.visitorId}`, { method: "DELETE" });
      }
      // Remove every local event for this token, including older entries
      // hidden by list deduplication, so deleting cannot reveal/re-sync one.
      await removeOutboxEntriesByQrToken(item.qrToken);

      return async () => {
        // Undo = re-scan: the cleanest way to restore the relationship,
        // since the underlying Visit row (or local outbox entry) was
        // genuinely removed by design.
        await addOutboxEntry({
          localId: crypto.randomUUID(),
          qrToken: item.qrToken,
          scannedAt: new Date().toISOString(),
        });
        syncEngine.requestFlush();
        await load();
      };
    },
    [load],
  );

  const pendingCount = useMemo(
    () => items.filter((item) => item.syncState !== "synced").length,
    [items],
  );

  return { items, search, setSearch, isLoading, remove, pendingCount, refresh: load };
}
