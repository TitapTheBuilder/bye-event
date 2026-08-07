"use client";

import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { StatusPill, VisitorTypeBadge } from "@/components/StatusPill";
import { VisitorForm, type VisitorFormValues } from "@/components/VisitorForm";
import { buttonPrimaryClassName, buttonSecondaryClassName, inputClassName } from "@/components/FormField";
import { useToast } from "@/lib/client/toast";
import { useVisitors } from "@/lib/client/use-visitors";
import type { Visitor } from "@repo/db";
import Link from "next/link";
import { useState } from "react";

function toFormValues(visitor?: Visitor): Partial<VisitorFormValues> | undefined {
  if (!visitor) return undefined;
  return {
    name: visitor.name ?? "",
    company: visitor.company ?? "",
    phoneNumber: visitor.phoneNumber ?? "",
    email: visitor.email ?? "",
    visitorType: visitor.visitorType,
  };
}

export default function VisitorsPage() {
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

  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; visitor: Visitor } | null>(
    null,
  );

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
        message: `Deactivated ${visitor.name ?? "visitor"}`,
        actionLabel: "Undo",
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

  function toggleSort(column: "createdAt" | "name" | "company") {
    if (query.sortBy === column) {
      setSort(column, query.sortDir === "asc" ? "desc" : "asc");
    } else {
      setSort(column, "asc");
    }
  }

  function sortIndicator(column: "createdAt" | "name" | "company") {
    if (query.sortBy !== column) return null;
    return query.sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Visitors</h1>
          <p className="text-sm text-text-secondary">Manage invited visitors and guest records.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/visitors/import" className={buttonSecondaryClassName}>
            Import
          </Link>
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className={buttonPrimaryClassName}
            style={{ background: "var(--brand-gradient)" }}
          >
            Add visitor
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, email, phone…"
          className={`${inputClassName} max-w-xs`}
        />
        <select
          value={query.visitorType ?? ""}
          onChange={(e) =>
            setVisitorTypeFilter(e.target.value === "" ? undefined : (e.target.value as "invited" | "guest"))
          }
          className={`${inputClassName} w-40`}
        >
          <option value="">All types</option>
          <option value="invited">Invited</option>
          <option value="guest">Guest</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={query.includeDeactivated}
            onChange={(e) => setIncludeDeactivated(e.target.checked)}
            className="h-4 w-4 rounded border-border-subtle"
          />
          Show deactivated
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort("company")}>
                Company{sortIndicator("company")}
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => toggleSort("createdAt")}
              >
                Created{sortIndicator("createdAt")}
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : visitors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  No visitors found.
                </td>
              </tr>
            ) : (
              visitors.map((visitor) => (
                <tr key={visitor.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 text-text-primary">{visitor.name ?? "—"}</td>
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
                        Edit
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
                        {visitor.deactivatedAt ? "Reactivate" : "Deactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={query.page} pageSize={query.pageSize} total={total} onPageChange={setPage} />

      {modal ? (
        <Modal
          title={modal.mode === "create" ? "Add visitor" : "Edit visitor"}
          onClose={() => setModal(null)}
        >
          <VisitorForm
            initialValues={modal.mode === "edit" ? toFormValues(modal.visitor) : undefined}
            submitLabel={modal.mode === "create" ? "Add visitor" : "Save changes"}
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
