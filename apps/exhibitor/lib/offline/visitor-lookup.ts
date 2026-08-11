import { cacheVisitor, getCachedVisitor } from "./idb";
import type { CachedVisitor } from "./types";

export type VisitorLookupResult =
  | { status: "found"; visitor: CachedVisitor }
  | { status: "not-found" }
  | { status: "pending-offline" };

/**
 * Check visitorCache first (instant, works offline). On a cache miss while
 * online, call the public, unauthenticated lookup endpoint and cache the
 * result. On a cache miss while offline, report a pending state instead of
 * failing -- the description page will show "details will load once
 * you're back online".
 */
async function fetchVisitor(identifier: string): Promise<Response> {
  return fetch("/api/visitors/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
    cache: "no-store",
  });
}

export async function resolveVisitor(qrToken: string): Promise<VisitorLookupResult> {
  const cached = await getCachedVisitor(qrToken);
  if (cached) return { status: "found", visitor: cached };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { status: "pending-offline" };
  }

  try {
    const response = await fetchVisitor(qrToken);
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "pending-offline" };

    const data = (await response.json()) as { visitor: Omit<CachedVisitor, "cachedAt"> };
    await cacheVisitor(data.visitor);
    return { status: "found", visitor: { ...data.visitor, cachedAt: new Date().toISOString() } };
  } catch {
    // Network error even though navigator.onLine said we were online
    // (flaky connection) -- treat the same as offline rather than as a
    // hard failure.
    return { status: "pending-offline" };
  }
}

/** Re-check a pending-offline visitor once connectivity returns. */
export async function refreshVisitor(qrToken: string): Promise<VisitorLookupResult> {
  try {
    const response = await fetchVisitor(qrToken);
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "pending-offline" };
    const data = (await response.json()) as { visitor: Omit<CachedVisitor, "cachedAt"> };
    await cacheVisitor(data.visitor);
    return { status: "found", visitor: { ...data.visitor, cachedAt: new Date().toISOString() } };
  } catch {
    return { status: "pending-offline" };
  }
}
