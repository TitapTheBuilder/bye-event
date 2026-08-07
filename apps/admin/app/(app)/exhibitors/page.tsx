"use client";

import { StatusPill } from "@/components/StatusPill";
import { useToast } from "@/lib/client/toast";
import type { Exhibitor } from "@repo/db";
import { useCallback, useEffect, useState } from "react";

export default function ExhibitorsPage() {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [includeDeactivated, setIncludeDeactivated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/exhibitors?includeDeactivated=${includeDeactivated}`);
      if (!res.ok) return;
      const data = await res.json();
      setExhibitors(data.exhibitors);
    } finally {
      setIsLoading(false);
    }
  }, [includeDeactivated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleToggleStatus(exhibitor: Exhibitor) {
    const wasActive = !exhibitor.deactivatedAt;
    const action = wasActive ? "deactivate" : "reactivate";
    await fetch(`/api/exhibitors/${exhibitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await refresh();

    if (wasActive) {
      showToast({
        message: `Deactivated ${exhibitor.name}`,
        actionLabel: "Undo",
        onAction: async () => {
          await fetch(`/api/exhibitors/${exhibitor.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reactivate" }),
          });
          await refresh();
        },
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Exhibitors</h1>
        <p className="text-sm text-text-secondary">
          Booth staff accounts. Exhibitors self-register from the scanner app; deactivate an
          account here if someone should lose access.
        </p>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={includeDeactivated}
          onChange={(e) => setIncludeDeactivated(e.target.checked)}
          className="h-4 w-4 rounded border-border-subtle"
        />
        Show deactivated
      </label>

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : exhibitors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No exhibitors have signed up yet.
                </td>
              </tr>
            ) : (
              exhibitors.map((exhibitor) => (
                <tr key={exhibitor.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 text-text-primary">{exhibitor.name}</td>
                  <td className="px-4 py-3 text-text-secondary">@{exhibitor.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{exhibitor.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={!exhibitor.deactivatedAt} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(exhibitor.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(exhibitor)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          exhibitor.deactivatedAt
                            ? "border-border-subtle text-text-primary hover:bg-surface-2"
                            : "border-danger/40 text-danger hover:bg-danger/10"
                        }`}
                      >
                        {exhibitor.deactivatedAt ? "Reactivate" : "Deactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
