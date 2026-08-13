"use client";

import type { Visitor } from "@repo/db";
import { useState } from "react";
import { buttonPrimaryClassName, inputClassName } from "@/components/FormField";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/StatusPill";
import { VisitorForm, type VisitorFormValues } from "@/components/VisitorForm";
import { useTranslation } from "@/lib/client/language-context";
import { useToast } from "@/lib/client/toast";
import { useVisitors } from "@/lib/client/use-visitors";

function toFormValues(visitor: Visitor): Partial<VisitorFormValues> {
  return {
    firstName: visitor.firstName ?? "",
    lastName: visitor.lastName ?? "",
    company: visitor.company ?? "",
    phoneNumber: visitor.phoneNumber ?? "",
    email: visitor.email ?? "",
    visitorType: visitor.visitorType,
  };
}

/**
 * Bulk guest-badge generation + the list of guest visitors whose details
 * get filled in later (§7), via the same visitor-edit form used for
 * invited visitors.
 */
export default function GuestsPage() {
  const { t, dir } = useTranslation();
  const { visitors, total, isLoading, refresh, query, setPage } = useVisitors({
    visitorType: "guest",
    pageSize: 20,
  });
  const { showToast } = useToast();

  const [count, setCount] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);
  const [editing, setEditing] = useState<Visitor | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/visitors/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "Could not generate guest badges");
        return;
      }
      setLastGenerated(data.visitors.length);
      await refresh();
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleEditSubmit(id: string, values: VisitorFormValues) {
    const res = await fetch(`/api/visitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false as const, error: data.error ?? "Could not update visitor" };
    }
    setEditing(null);
    await refresh();
    return { ok: true as const };
  }

  async function handleDeactivate(visitor: Visitor) {
    await fetch(`/api/visitors/${visitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" }),
    });
    await refresh();
    showToast({
      message: t("guests.badgeDeactivated"),
      actionLabel: t("common.undo"),
      onAction: async () => {
        await fetch(`/api/visitors/${visitor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reactivate" }),
        });
        await refresh();
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("guests.title")}</h1>
        <p className="text-sm text-text-secondary">{t("guests.subtitle")}</p>
      </div>

      <form
        onSubmit={handleGenerate}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4"
      >
        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          {t("guests.countLabel")}
          <input
            type="number"
            min={1}
            max={5000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`${inputClassName} w-40`}
          />
        </label>
        <button
          type="submit"
          disabled={isGenerating}
          className={buttonPrimaryClassName}
          style={{ background: "var(--brand-gradient)" }}
        >
          {isGenerating ? t("guests.generating") : t("guests.generate")}
        </button>
        {generateError ? <p className="text-sm text-danger">{generateError}</p> : null}
        {lastGenerated !== null ? (
          <p className="text-sm text-success">
            {t("guests.generated", { count: lastGenerated.toString() })}
          </p>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className={`w-full min-w-[640px] text-sm text-${dir === "rtl" ? "end" : "start"}`}>
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th className="px-4 py-3">Short Code</th>
              <th className="px-4 py-3">{t("visitors.firstName")}</th>
              <th className="px-4 py-3">{t("visitors.lastName")}</th>
              <th className="px-4 py-3">{t("visitors.company")}</th>
              <th className="px-4 py-3">{t("visitors.contact")}</th>
              <th className="px-4 py-3">{t("visitors.status")}</th>
              <th className="px-4 py-3">{t("visitors.created")}</th>
              <th className={`px-4 py-3 text-${dir === "rtl" ? "start" : "end"}`}>
                {t("visitors.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  {t("common.loading")}
                </td>
              </tr>
            ) : visitors.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  {t("guests.noGuests")}
                </td>
              </tr>
            ) : (
              visitors.map((visitor) => (
                <tr key={visitor.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 font-mono text-sm text-text-primary">{visitor.shortCode}</td>
                  <td className="px-4 py-3 text-text-primary">
                    {visitor.firstName ?? t("guests.unfilled")}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{visitor.lastName ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{visitor.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div>{visitor.phoneNumber ?? "—"}</div>
                    <div className="text-xs text-text-muted">{visitor.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={!visitor.deactivatedAt} />
                  </td>
                  <td className="px-4 py-3 text-text-muted" suppressHydrationWarning>
                    {new Date(visitor.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(visitor)}
                        className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-2"
                      >
                        {t("guests.fillDetails")}
                      </button>
                      {!visitor.deactivatedAt ? (
                        <button
                          type="button"
                          onClick={() => void handleDeactivate(visitor)}
                          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
                        >
                          {t("visitors.deactivate")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        onPageChange={setPage}
      />

      {editing ? (
        <Modal title={t("guests.guestDetails")} onClose={() => setEditing(null)}>
          <VisitorForm
            initialValues={toFormValues(editing)}
            submitLabel={t("guests.saveDetails")}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => handleEditSubmit(editing.id, values)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
