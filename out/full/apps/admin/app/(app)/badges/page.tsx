"use client";

import { buttonPrimaryClassName, inputClassName } from "@/components/FormField";
import { useTranslation } from "@/lib/client/language-context";
import type { Visitor } from "@repo/db";
import { useEffect, useState } from "react";

type VisitorType = "invited" | "guest";
type Mode = "all" | "select";

async function downloadBadgePdf(visitorType: VisitorType, visitorIds?: string[]) {
  const res = await fetch("/api/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorType, visitorIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Could not generate badge PDF");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${visitorType}-badges.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BadgesPage() {
  const { t, dir } = useTranslation();
  const [visitorType, setVisitorType] = useState<VisitorType>("invited");
  const [mode, setMode] = useState<Mode>("all");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Visitor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "select") return;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({
        visitorType,
        pageSize: "200",
        ...(search ? { q: search } : {}),
      });
      const res = await fetch(`/api/visitors?${params.toString()}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setCandidates(data.visitors);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, visitorType, search]);

  useEffect(() => {
    setSelected(new Set());
  }, []);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);
    try {
      const visitorIds = mode === "select" ? Array.from(selected) : undefined;
      if (mode === "select" && (!visitorIds || visitorIds.length === 0)) {
        setError(t("badges.selectFirst"));
        return;
      }
      await downloadBadgePdf(visitorType, visitorIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate badge PDF");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("badges.title")}</h1>
        <p className="text-sm text-text-secondary">
          {t("badges.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-lg border border-border-subtle p-1">
          {(["invited", "guest"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setVisitorType(type)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${
                visitorType === type ? "bg-surface-3 text-text-primary" : "text-text-secondary"
              }`}
            >
              {type === "invited" ? t("common.invited") : t("common.guest")}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-border-subtle p-1">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === "all" ? "bg-surface-3 text-text-primary" : "text-text-secondary"
            }`}
          >
            {t("badges.allActive")}
          </button>
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === "select" ? "bg-surface-3 text-text-primary" : "text-text-secondary"
            }`}
          >
            {t("badges.chooseSpecific")}
          </button>
        </div>
      </div>

      {mode === "select" ? (
        <div className="flex flex-col gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("badges.searchVisitors")}
            className={`${inputClassName} max-w-sm`}
          />
          <div className="max-h-80 overflow-auto rounded-2xl border border-border-subtle bg-surface-1">
            {candidates.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">{t("badges.noMatching")}</p>
            ) : (
              <ul>
                {candidates.map((visitor) => (
                  <li
                    key={visitor.id}
                    className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(visitor.id)}
                      onChange={() => toggleSelected(visitor.id)}
                      className="h-4 w-4 rounded border-border-subtle"
                    />
                    <span className="text-sm text-text-primary">
                      {visitor.name ?? t("badges.unfilledGuest")}
                    </span>
                    <span className="text-xs text-text-muted">{visitor.company}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-text-muted">{t("badges.selected", { count: selected.size.toString() })}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={isGenerating}
        className={`w-fit ${buttonPrimaryClassName}`}
        style={{ background: "var(--brand-gradient)" }}
      >
        {isGenerating ? t("badges.generating") : t("badges.download")}
      </button>
    </div>
  );
}
