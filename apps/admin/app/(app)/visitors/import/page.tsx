"use client";

import { buttonPrimaryClassName, buttonSecondaryClassName } from "@/components/FormField";
import { useTranslation } from "@/lib/client/language-context";
import Link from "next/link";
import { useRef, useState } from "react";

interface ImportRowResult {
  rowNumber: number;
  raw: Record<string, unknown>;
  valid: boolean;
  data?: { name?: string; company?: string; phoneNumber?: string; email?: string };
  errors?: string[];
}

interface PreviewState {
  rows: ImportRowResult[];
  validCount: number;
  invalidCount: number;
}

export default function ImportVisitorsPage() {
  const { t, dir } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setPreview(null);
    setImportedCount(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/visitors/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not parse file");
        return;
      }
      setPreview(data);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    const validRows = preview.rows.filter((r) => r.valid && r.data).map((r) => r.data);
    if (validRows.length === 0) return;

    setIsCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/visitors/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setImportedCount(data.insertedCount);
      setPreview(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("import.title")}</h1>
          <p className="text-sm text-text-secondary">
            {t("import.subtitle")}
          </p>
        </div>
        <Link href="/visitors" className={buttonSecondaryClassName}>
          {t("import.backToVisitors")}
        </Link>
      </div>

      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1 p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="mx-auto block text-sm text-text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-surface-3 file:px-4 file:py-2 file:text-sm file:font-medium file:text-text-primary"
        />
        <p className="mt-3 text-xs text-text-muted">
          {t("import.expectedColumns")}
        </p>
        {isUploading ? <p className="mt-3 text-sm text-text-secondary">{t("import.parsing", { name: fileName ?? "" })}</p> : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {importedCount !== null ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
          {t("import.imported", { count: importedCount.toString() })}
        </div>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-success">{t("import.valid", { count: preview.validCount.toString() })}</span>
              {" · "}
              <span className="font-medium text-danger">{t("import.invalid", { count: preview.invalidCount.toString() })}</span>
              {" · "}
              {t("import.totalRows", { count: preview.rows.length.toString() })}
            </p>
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={preview.validCount === 0 || isCommitting}
              className={buttonPrimaryClassName}
              style={{ background: "var(--brand-gradient)" }}
            >
              {isCommitting ? t("import.importing") : t("import.importButton", { count: preview.validCount.toString() })}
            </button>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-2xl border border-border-subtle bg-surface-1">
            <table className={`w-full min-w-[720px] text-sm text-${dir === "rtl" ? "end" : "start"}`}>
              <thead className="sticky top-0 border-b border-border-subtle bg-surface-1 text-text-secondary">
                <tr>
                  <th className="px-4 py-3">{t("import.row")}</th>
                  <th className="px-4 py-3">{t("import.name")}</th>
                  <th className="px-4 py-3">{t("import.company")}</th>
                  <th className="px-4 py-3">{t("import.phone")}</th>
                  <th className="px-4 py-3">{t("import.email")}</th>
                  <th className="px-4 py-3">{t("import.statusCol")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-b border-border-subtle last:border-0 ${
                      row.valid ? "" : "bg-danger/5"
                    }`}
                  >
                    <td className="px-4 py-2 text-text-muted">{row.rowNumber}</td>
                    <td className="px-4 py-2 text-text-primary">{row.data?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-text-secondary">{row.data?.company ?? "—"}</td>
                    <td className="px-4 py-2 text-text-secondary">{row.data?.phoneNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-text-secondary">{row.data?.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      {row.valid ? (
                        <span className="text-xs font-medium text-success">{t("import.validStatus")}</span>
                      ) : (
                        <span className="text-xs text-danger">{row.errors?.join("; ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
