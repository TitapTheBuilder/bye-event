import { z } from "zod";

/** One outbox entry as flushed by the exhibitor PWA's sync engine. */
export const visitSyncEntrySchema = z.object({
  localId: z.string().uuid(),
  qrToken: z.string().trim().min(1).max(64),
  scannedAt: z.string().datetime(),
});
export type VisitSyncEntry = z.infer<typeof visitSyncEntrySchema>;

export const visitSyncRequestSchema = z.object({
  entries: z.array(visitSyncEntrySchema).min(1).max(500),
});
export type VisitSyncRequest = z.infer<typeof visitSyncRequestSchema>;

export type VisitSyncErrorCode = "visitor_not_found" | "sync_failed";

export interface VisitSyncResultEntry {
  localId: string;
  status: "synced" | "error";
  error?: string;
  errorCode?: VisitSyncErrorCode;
}
export interface VisitSyncResponse {
  results: VisitSyncResultEntry[];
}
