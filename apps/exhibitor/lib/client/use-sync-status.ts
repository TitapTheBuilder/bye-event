"use client";

import { useEffect, useState } from "react";
import { syncEngine } from "@/lib/offline/sync-engine";
import type { SyncStatus } from "@/lib/offline/types";

export function useSyncStatus(): { status: SyncStatus; pendingCount: number } {
  const [state, setState] = useState<{ status: SyncStatus; pendingCount: number }>({
    status: syncEngine.getStatus(),
    pendingCount: 0,
  });

  useEffect(() => syncEngine.subscribe(setState), []);

  return state;
}
