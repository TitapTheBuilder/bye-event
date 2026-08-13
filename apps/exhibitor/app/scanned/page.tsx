"use client";

import { formatPersonName } from "@repo/shared/person-name";
import Link from "next/link";
import { useState } from "react";
import { VisitorTypeBadge } from "@/components/VisitorTypeBadge";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { useToast } from "@/lib/client/toast";
import { type ScannedListItem, useScannedList } from "@/lib/client/use-scanned-list";
import { serializeScannedVisitorsCsv } from "@/lib/scanned-export";

export default function ScannedListPage() {
  const { items, search, setSearch, isLoading, remove } = useScannedList();
  const { exhibitor } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: "csv" | "pdf") {
    if (items.length === 0) return;
    setExporting(format);
    setExportError(null);

    const date = new Date().toISOString().slice(0, 10);
    const filename = `scanned-visitors-${date}.${format}`;

    if (format === "csv") {
      try {
        const csvContent = serializeScannedVisitorsCsv(items);
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setExportError(t("scanned.exportError"));
      } finally {
        setExporting(null);
      }
      return;
    }

    try {
      const exhibitorName = exhibitor
        ? formatPersonName(exhibitor.firstName, exhibitor.lastName)
        : "Exhibitor";
      const response = await fetch("/api/visits/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "pdf",
          exhibitorName,
          items: items.map((item) => ({
            visitorId: item.visitorId ?? item.localId ?? item.key,
            firstName: item.firstName,
            lastName: item.lastName,
            company: item.company,
            phoneNumber: item.phoneNumber,
            email: item.email,
            visitorType: item.visitorType ?? "invited",
            lastScannedAt: item.scannedAt,
          })),
        }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("scanned.exportError"));
    } finally {
      setExporting(null);
    }
  }

  async function handleDelete(item: ScannedListItem) {
    const undo = await remove(item);
    showToast({
      message: t("scanned.removed", {
        name: formatPersonName(item.firstName, item.lastName) || "visitor",
      }),
      actionLabel: t("common.undo"),
      onAction: () => void undo(),
    });
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">{t("scanned.title")}</h1>
        <div className="flex gap-2">
          {(["csv", "pdf"] as const).map((format) => (
            <button
              key={format}
              type="button"
              disabled={exporting !== null || items.length === 0}
              onClick={() => void handleExport(format)}
              className="min-h-11 rounded-xl border border-border-subtle bg-surface-1 px-3 text-sm font-medium text-text-primary disabled:opacity-40"
            >
              {exporting === format
                ? t("scanned.exporting")
                : t(format === "csv" ? "scanned.exportCsv" : "scanned.exportPdf")}
            </button>
          ))}
        </div>
      </div>

      {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("scanned.search")}
        aria-label="Search scanned visitors"
        className="w-full rounded-xl border border-border-subtle bg-surface-1 px-4 py-2.5 text-text-primary placeholder:text-text-muted"
      />

      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-secondary">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">{t("scanned.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const displayName = formatPersonName(item.firstName, item.lastName);
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-1 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-text-primary">
                      {displayName || t("scanned.pending")}
                    </p>
                    {item.visitorType ? <VisitorTypeBadge visitorType={item.visitorType} /> : null}
                  </div>
                  <p className="truncate text-sm text-text-secondary" suppressHydrationWarning>
                    {item.company ?? ""}
                    {item.company ? " · " : ""}
                    {new Date(item.scannedAt).toLocaleString()}
                  </p>
                  {item.syncState !== "synced" ? (
                    <p className="text-xs text-text-muted">
                      {item.syncState === "sync-error"
                        ? t("scanned.syncError")
                        : t("scanned.willSync")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/visitor/${encodeURIComponent(item.qrToken)}?scannedAt=${encodeURIComponent(item.scannedAt)}`}
                    aria-label={`View ${displayName || "visitor"}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-surface-2"
                  >
                    <EyeIcon />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${displayName || "visitor"}`}
                    onClick={() => void handleDelete(item)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-surface-2"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>View visitor</title>
      <path
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Remove visitor</title>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
