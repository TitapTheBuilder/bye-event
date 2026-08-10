"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScanButton } from "@/components/ScanButton";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { getUnsyncedOutboxEntries } from "@/lib/offline/idb";

export default function HomePage() {
  const { exhibitor } = useAuth();
  const { t } = useTranslation();
  const [scannedCount, setScannedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (exhibitor) {
          const res = await fetch("/api/visits");
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setScannedCount(data.visits.length);
            return;
          }
        }
        const outbox = await getUnsyncedOutboxEntries();
        if (!cancelled) setScannedCount(outbox.length);
      } catch {
        if (!cancelled) setScannedCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exhibitor]);

  return (
    <div className="flex min-h-[calc(100dvh-4rem-5rem)] flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {exhibitor ? t("home.welcomeUser", { name: exhibitor.firstName }) : t("home.scanToStart")}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{t("home.pointCamera")}</p>
      </div>

      <ScanButton />

      <Link
        href="/scanned"
        className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-1 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-2"
      >
        {t("home.scannedVisitors")}
        {scannedCount !== null && scannedCount > 0 ? (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {scannedCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
