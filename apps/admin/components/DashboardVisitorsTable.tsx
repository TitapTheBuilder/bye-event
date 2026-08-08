"use client";

import { Pagination } from "@/components/Pagination";
import { VisitorTypeBadge } from "@/components/StatusPill";
import { useVisitors } from "@/lib/client/use-visitors";
import { useTranslation } from "@/lib/client/language-context";
import { inputClassName } from "@/components/FormField";
import { Fragment, useState } from "react";

interface ExhibitorForVisitor {
  exhibitorId: string;
  exhibitorName: string;
  scanCount: number;
  lastScannedAt: string;
}

/** Searchable visitors table that expands to show which exhibitors
 * scanned each one (§7). */
export function DashboardVisitorsTable() {
  const { t, dir } = useTranslation();
  const { visitors, total, isLoading, query, setSearch, setPage } = useVisitors({ pageSize: 10 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exhibitorsById, setExhibitorsById] = useState<Record<string, ExhibitorForVisitor[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<string | null>(null);

  async function toggleExpand(visitorId: string) {
    if (expandedId === visitorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(visitorId);
    if (!exhibitorsById[visitorId]) {
      setLoadingExpand(visitorId);
      try {
        const res = await fetch(`/api/visitors/${visitorId}`);
        if (res.ok) {
          const data = await res.json();
          setExhibitorsById((prev) => ({ ...prev, [visitorId]: data.exhibitors }));
        }
      } finally {
        setLoadingExpand(null);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("dashTable.searchPlaceholder")}
        className={`${inputClassName} max-w-sm`}
      />

      <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-1">
        <table className={`w-full min-w-[640px] text-sm text-${dir === "rtl" ? "end" : "start"}`}>
          <thead className="border-b border-border-subtle text-text-secondary">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">{t("dashTable.name")}</th>
              <th className="px-4 py-3">{t("dashTable.company")}</th>
              <th className="px-4 py-3">{t("dashTable.type")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  {t("common.loading")}
                </td>
              </tr>
            ) : visitors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  {t("dashTable.noVisitors")}
                </td>
              </tr>
            ) : (
              visitors.map((visitor) => (
                <Fragment key={visitor.id}>
                  <tr
                    onClick={() => void toggleExpand(visitor.id)}
                    className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 text-text-muted">
                      {expandedId === visitor.id ? "▾" : "▸"}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{visitor.name ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{visitor.company ?? "—"}</td>
                    <td className="px-4 py-3">
                      <VisitorTypeBadge visitorType={visitor.visitorType} />
                    </td>
                  </tr>
                  {expandedId === visitor.id ? (
                    <tr key={`${visitor.id}-expanded`} className="border-b border-border-subtle bg-surface-0/40">
                      <td colSpan={4} className="px-4 py-3">
                        {loadingExpand === visitor.id ? (
                          <p className="text-sm text-text-secondary">{t("dashTable.loadingScans")}</p>
                        ) : (exhibitorsById[visitor.id]?.length ?? 0) === 0 ? (
                          <p className="text-sm text-text-secondary">
                            {t("dashTable.noScans")}
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {exhibitorsById[visitor.id]?.map((row) => (
                              <li
                                key={row.exhibitorId}
                                className="flex items-center justify-between text-sm text-text-secondary"
                              >
                                <span className="text-text-primary">{row.exhibitorName}</span>
                                <span>
                                  {t("dashTable.scans", { count: row.scanCount.toString() })} · {t("dashTable.lastScan", { date: new Date(row.lastScannedAt).toLocaleString() })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={query.page} pageSize={query.pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
