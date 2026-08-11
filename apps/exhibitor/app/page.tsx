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

  async function processToken(token: string) {
    if (token.length !== 6 || isProcessing) return;
    setIsProcessing(true);
    await recordScan(token);
    router.push(`/visitor/${encodeURIComponent(token)}`);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    setManualToken(newVal);
    if (newVal.length === 6) {
      void processToken(newVal);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    void processToken(manualToken.trim());
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
        className="flex w-full max-w-[200px] flex-col items-center gap-3 mx-auto mt-4"
      >
        <p className="text-sm text-text-secondary">{t("scan.orEnterCode")}</p>
        <input
          value={manualToken}
          onChange={handleInputChange}
          placeholder={"000000"}
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={isProcessing}
          className="w-full rounded-full border border-border-subtle bg-surface-1 px-4 py-2.5 text-center text-lg font-mono text-text-primary placeholder:text-text-muted tracking-widest focus:outline-none focus:ring-2 focus:ring-border-subtle disabled:opacity-50"
        />
      </form>


    </div>
  );
}
