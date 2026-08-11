export interface CachedVisitor {
  qrToken: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType: "invited" | "guest";
  /** ISO timestamp of when this was last written from a server response. */
  cachedAt: string;
}

/**
 * An append-only-ish log of scan events. A scan writes one of these
 * IMMEDIATELY and unconditionally -- before any network call, before
 * checking login state (see lib/offline/scan.ts).
 */
export interface OutboxEntry {
  /** Client-generated UUID -- the idempotency key for this scan event. */
  localId: string;
  qrToken: string;
  /** ISO timestamp of when the scan actually happened on-device. */
  scannedAt: string;
  /** Missing values are legacy records and are treated as unowned. */
  ownerExhibitorId?: string | null;
  synced: boolean;
  /** Set once the server has told us this entry can never succeed (e.g. an
   * unrecognized qr_token) so the auto-sync loop stops hammering it. The
   * scanned-list UI can still offer a manual retry that clears this. */
  permanentError?: boolean;
  lastError?: string;
  lastAttemptAt?: string;
}

export type SyncStatus = "idle" | "syncing" | "offline" | "signed-out" | "error";
