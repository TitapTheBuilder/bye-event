"use client";

import { useTranslation } from "@/lib/client/language-context";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-text-secondary">
      <span>
        {total === 0 ? t("common.noResults") : t("common.showing", { from: from.toString(), to: to.toString(), total: total.toString() })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-border-subtle px-3 py-1.5 font-medium text-text-primary disabled:opacity-40"
        >
          {t("common.previous")}
        </button>
        <span className="px-1">
          {t("common.page", { current: page.toString(), total: totalPages.toString() })}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-border-subtle px-3 py-1.5 font-medium text-text-primary disabled:opacity-40"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}
