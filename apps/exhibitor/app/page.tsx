"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScanButton } from "@/components/ScanButton";
import { recordScan } from "@/lib/offline/scan";
import { useAuth } from "@/lib/client/auth-context";
import { useTranslation } from "@/lib/client/language-context";
import { getUnsyncedOutboxEntries } from "@/lib/offline/idb";

export default function HomePage() {
  const router = useRouter();
  const { exhibitor } = useAuth();
  const { t } = useTranslation();
  const [scannedCount, setScannedCount] = useState<number | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = manualToken.trim();
    if (token.length !== 6 || isProcessing) return;
    setIsProcessing(true);
    await recordScan(token);
    router.push(`/visitor/${encodeURIComponent(token)}`);
  }

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

      <form
        onSubmit={handleManualSubmit}
        className="flex w-full max-w-xs flex-col items-center gap-2"
      >
        <p className="text-sm text-text-secondary">{t("scan.orEnterCode", "Or enter 6-digit code:")}</p>
        <div className="flex w-full items-center gap-2">
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder={"000000"}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            className="flex-1 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 text-center text-lg font-mono text-text-primary placeholder:text-text-muted tracking-widest focus:outline-none focus:ring-2 focus:ring-border-subtle"
          />
          <button
            type="submit"
            disabled={isProcessing || manualToken.trim().length !== 6}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {t("scan.go", "Go")}
          </button>
        </div>
      </form>

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
