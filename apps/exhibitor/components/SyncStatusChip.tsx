"use client";

import { useSyncStatus } from "@/lib/client/use-sync-status";
import { useTranslation } from "@/lib/client/language-context";

const DOT_CLASSES: Record<string, string> = {
  idle: "bg-success",
  syncing: "bg-brand-accent animate-pulse",
  offline: "bg-text-muted",
  "signed-out": "bg-text-muted",
  error: "bg-danger",
};

export function SyncStatusChip({ className }: { className?: string }) {
  const { status, pendingCount } = useSyncStatus();
  const { t } = useTranslation();

  const labelMap: Record<string, string> = {
    idle: t("sync.synced"),
    syncing: t("sync.syncing"),
    offline: t("sync.offline"),
    "signed-out": t("sync.signedOut"),
    error: t("sync.error"),
  };

  const label =
    status === "idle" && pendingCount === 0 ? t("sync.synced") : (labelMap[status] ?? t("sync.offline"));

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs text-text-secondary ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[status] ?? "bg-text-muted"}`} />
      {label}
      {pendingCount > 0 && status !== "idle" ? ` (${pendingCount})` : null}
    </span>
  );
}
