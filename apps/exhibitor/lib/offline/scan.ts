import { addOutboxEntry } from "./idb";
import { syncEngine } from "./sync-engine";

/**
 * The scan flow's second step: write a visitOutbox entry immediately and
 * unconditionally -- before any network call, before checking login
 * state. Visitor lookup (lib/offline/visitor-lookup.ts) happens
 * separately/in parallel; it must never gate this write.
 */
export async function recordScan(qrToken: string): Promise<{ localId: string }> {
  const localId = crypto.randomUUID();
  const scannedAt = new Date().toISOString();

  await addOutboxEntry({ localId, qrToken, scannedAt });

  // Fire-and-forget: only actually pushes if authenticated + online.
  syncEngine.requestFlush();

  return { localId };
}
