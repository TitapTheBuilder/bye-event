"use client";

import type { Visitor } from "@repo/db";
import { formatPersonName } from "@repo/shared/person-name";
import Link from "next/link";
import { useState } from "react";
import {
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  inputClassName,
} from "@/components/FormField";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { StatusPill, VisitorTypeBadge } from "@/components/StatusPill";
import { VisitorForm, type VisitorFormValues } from "@/components/VisitorForm";
import { useTranslation } from "@/lib/client/language-context";
import { useToast } from "@/lib/client/toast";
import { useVisitors } from "@/lib/client/use-visitors";

function toFormValues(visitor?: Visitor): Partial<VisitorFormValues> | undefined {
  if (!visitor) return undefined;
  return {
    firstName: visitor.firstName ?? "",
    lastName: visitor.lastName ?? "",
    company: visitor.company ?? "",
    phoneNumber: visitor.phoneNumber ?? "",
    email: visitor.email ?? "",
    visitorType: visitor.visitorType,
  };
}

export default function VisitorsPage() {
  const { t, dir } = useTranslation();
  const {
    query,
    visitors,
    total,
    isLoading,
    refresh,
    setPage,
    setSearch,
    setVisitorTypeFilter,
    setIncludeDeactivated,
    setSort,
  } = useVisitors();
  const { showToast } = useToast();

  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; visitor: Visitor } | null
  >(null);

  async function handleCreate(values: VisitorFormValues) {
    const res = await fetch("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false as const, error: data.error ?? "Could not create visitor" };
    }
    setModal(null);
    await refresh();
    return { ok: true as const };
  }

  async function handleEdit(id: string, values: VisitorFormValues) {
    const res = await fetch(`/api/visitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false as const, error: data.error ?? "Could not update visitor" };
    }
    setModal(null);
    await refresh();
    return { ok: true as const };
  }

  async function handleToggleStatus(visitor: Visitor) {
    const wasActive = !visitor.deactivatedAt;
    const action = wasActive ? "deactivate" : "reactivate";
    await fetch(`/api/visitors/${visitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await refresh();

    if (wasActive) {
      showToast({
        message: t("visitors.deactivated", {
          name: formatPersonName(visitor.firstName, visitor.lastName) || t("common.guest"),
        }),
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
  }

  function toggleSort(column: "createdAt" | "firstName" | "lastName" | "company") {
    if (query.sortBy === column) {
      setSort(column, query.sortDir === "asc" ? "desc" : "asc");
    } else {
      setSort(column, "asc");
    }
  }

  function sortIndicator(column: "createdAt" | "firstName" | "lastName" | "company") {
    if (query.sortBy !== column) return null;
    return query.sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("visitors.title")}</h1>
          <p className="text-sm text-text-secondary">{t("visitors.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/visitors/import" className={buttonSecondaryClassName}>
            {t("visitors.import")}
          </Link>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className={buttonPrimaryClassName}
            style={{ background: "var(--brand-gradient)" }}
          >
            {t("visitors.addVisitor")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("visitors.searchPlaceholder")}
          className={`${inputClassName} max-w-xs`}
        />
        <select
          value={query.visitorType ?? ""}
          onChange={(e) =>
            setVisitorTypeFilter(
              e.target.value === "" ? undefined : (e.target.value as "invited" | "guest"),
            )
          }
          className={`${inputClassName} w-40`}
        >
          <option value="">{t("visitors.allTypes")}</option>
          <option value="invited">{t("common.invited")}</option>
          <option value="guest">{t("common.guest")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={query.includeDeactivated}
            onChange={(e) => setIncludeDeactivated(e.target.checked)}
            className="h-4 w-4 rounded border-border-subtle"
          />
          {t("visitors.showDeactivated")}
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className={`w-full min-w-[820px] text-sm text-${dir === "rtl" ? "end" : "start"}`}>
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => toggleSort("firstName")}
              >
                {t("visitors.firstName")}
                {sortIndicator("firstName")}
              </th>
              <th
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => toggleSort("lastName")}
              >
                {t("visitors.lastName")}
                {sortIndicator("lastName")}
              </th>
              <th
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => toggleSort("company")}
              >
                {t("visitors.company")}
                {sortIndicator("company")}
              </th>
              <th className="px-4 py-3">{t("visitors.contact")}</th>
              <th className="px-4 py-3">{t("visitors.type")}</th>
              <th className="px-4 py-3">{t("visitors.status")}</th>
              <th
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => toggleSort("createdAt")}
              >
                {t("visitors.created")}
                {sortIndicator("createdAt")}
              </th>
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
                  {t("visitors.noVisitors")}
                </td>
              </tr>
            ) : (
              visitors.map((visitor) => (
                <tr key={visitor.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 text-text-primary">{visitor.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-text-primary">{visitor.lastName ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{visitor.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div>{visitor.phoneNumber ?? "—"}</div>
                    <div className="text-xs text-text-muted">{visitor.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <VisitorTypeBadge visitorType={visitor.visitorType} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={!visitor.deactivatedAt} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(visitor.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", visitor })}
                        className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-2"
                      >
                        {t("visitors.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(visitor)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          visitor.deactivatedAt
                            ? "border-border-subtle text-text-primary hover:bg-surface-2"
                            : "border-danger/40 text-danger hover:bg-danger/10"
                        }`}
                      >
                        {visitor.deactivatedAt
                          ? t("visitors.reactivate")
                          : t("visitors.deactivate")}
                      </button>
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

      {modal ? (
        <Modal
          title={modal.mode === "create" ? t("visitors.addTitle") : t("visitors.editTitle")}
          onClose={() => setModal(null)}
        >
          <VisitorForm
            initialValues={modal.mode === "edit" ? toFormValues(modal.visitor) : undefined}
            submitLabel={
              modal.mode === "create" ? t("visitors.addSubmit") : t("visitors.editSubmit")
            }
            onCancel={() => setModal(null)}
            onSubmit={(values) =>
              modal.mode === "create" ? handleCreate(values) : handleEdit(modal.visitor.id, values)
            }
          />
        </Modal>
      ) : null}
    </div>
  );
}
