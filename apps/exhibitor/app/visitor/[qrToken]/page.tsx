"use client";

import { formatPersonName } from "@repo/shared/person-name";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SyncStatusChip } from "@/components/SyncStatusChip";
import { VisitorTypeBadge } from "@/components/VisitorTypeBadge";
import { useTranslation } from "@/lib/client/language-context";
import { getOutboxEntryByQrToken } from "@/lib/offline/idb";
import type { CachedVisitor } from "@/lib/offline/types";
import { refreshVisitor, resolveVisitor } from "@/lib/offline/visitor-lookup";

type State =
  | { status: "loading" }
  | { status: "found"; visitor: CachedVisitor }
  | { status: "not-found" }
  | { status: "pending-offline" };

export default function VisitorDescriptionPage() {
  const router = useRouter();
  const params = useParams<{ qrToken: string }>();
  const searchParams = useSearchParams();
  const qrToken = decodeURIComponent(params.qrToken);
  const [state, setState] = useState<State>({ status: "loading" });
  const [scannedAt, setScannedAt] = useState<string | null>(searchParams.get("scannedAt"));
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await resolveVisitor(qrToken);
      if (cancelled) return;
      setState(result);

      if (!scannedAt) {
        const outboxEntry = await getOutboxEntryByQrToken(qrToken);
        if (!cancelled && outboxEntry) setScannedAt(outboxEntry.scannedAt);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qrToken, scannedAt]);

  useEffect(() => {
    if (state.status !== "pending-offline") return;

    const retry = async () => {
      const result = await refreshVisitor(qrToken);
      setState(result);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [state.status, qrToken]);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start text-sm text-text-secondary"
      >
        {t("visitor.back")}
      </button>

      {state.status === "loading" ? (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-2/3 rounded bg-surface-2" />
          <div className="h-4 w-1/2 rounded bg-surface-2" />
        </div>
      ) : null}

      {state.status === "not-found" ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-6 text-center">
          <p className="text-text-primary">{t("visitor.notFound")}</p>
          <p className="mt-1 text-sm text-text-secondary">{t("visitor.notFoundHint")}</p>
        </div>
      ) : null}

      {state.status === "pending-offline" ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-6 text-center">
          <p className="text-text-primary">{t("visitor.pendingOffline")}</p>
          <p className="mt-1 text-sm text-text-secondary">{t("visitor.savedOnDevice")}</p>
        </div>
      ) : null}

      {state.status === "found" ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                {formatPersonName(state.visitor.firstName, state.visitor.lastName) ||
                  t("visitor.guestVisitor")}
              </h1>
              {state.visitor.company ? (
                <p className="text-sm text-text-secondary">{state.visitor.company}</p>
              ) : null}
            </div>
            <VisitorTypeBadge visitorType={state.visitor.visitorType} />
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {state.visitor.phoneNumber ? (
              <a
                href={`tel:${state.visitor.phoneNumber}`}
                className="flex min-h-[44px] items-center gap-3 rounded-xl bg-surface-2 px-4 text-text-primary"
              >
                <PhoneIcon /> {state.visitor.phoneNumber}
              </a>
            ) : null}
            {state.visitor.email ? (
              <a
                href={`mailto:${state.visitor.email}`}
                className="flex min-h-[44px] items-center gap-3 rounded-xl bg-surface-2 px-4 text-text-primary"
              >
                <MailIcon /> {state.visitor.email}
              </a>
            ) : null}
            {!state.visitor.phoneNumber && !state.visitor.email ? (
              <p className="text-sm text-text-muted">{t("visitor.noContact")}</p>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
            <span className="text-xs text-text-muted">
              {scannedAt
                ? t("visitor.scannedAt", { date: new Date(scannedAt).toLocaleString() })
                : null}
            </span>
            <SyncStatusChip />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Phone</title>
      <path
        d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.5 2.4.8 3.7.9.6 0 1 .5 1 1v3.6c0 .6-.4 1-1 1C11.6 21.5 2.5 12.4 2.5 3.9c0-.6.4-1 1-1H7c.6 0 1 .4 1 1 .1 1.3.4 2.5.9 3.7.2.3.1.7-.2 1L6.6 10.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Email</title>
      <path
        d="M3 6h18v12H3V6Zm18 0-9 7-9-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
