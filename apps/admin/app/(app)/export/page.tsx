"use client";

import { useState } from "react";

const ENTITIES = [
  { key: "visitors", label: "Visitors", description: "All invited and guest visitor records." },
  { key: "exhibitors", label: "Exhibitors", description: "Booth staff accounts." },
  { key: "visits", label: "Visits", description: "Every scan, with exhibitor and visitor names." },
] as const;

const FORMATS = ["csv", "xlsx", "json"] as const;

/**
 * Data export (§7). Full raw database backups are an infra concern
 * (pg_dump on a schedule), not reinvented here -- these are flat,
 * human-readable snapshots for the event team.
 */
export default function ExportPage() {
  const [includeDeactivated, setIncludeDeactivated] = useState(false);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Data export</h1>
        <p className="text-sm text-text-secondary">
          Download a snapshot of visitors, exhibitors, or visits as CSV, XLSX, or JSON.
        </p>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={includeDeactivated}
          onChange={(e) => setIncludeDeactivated(e.target.checked)}
          className="h-4 w-4 rounded border-border-subtle"
        />
        Include deactivated records
      </label>

      <div className="flex flex-col gap-4">
        {ENTITIES.map((entity) => (
          <div
            key={entity.key}
            className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-medium text-text-primary">{entity.label}</h2>
              <p className="text-sm text-text-secondary">{entity.description}</p>
            </div>
            <div className="flex gap-2">
              {FORMATS.map((format) => (
                <a
                  key={format}
                  href={`/api/export?entity=${entity.key}&format=${format}&includeDeactivated=${includeDeactivated}`}
                  className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium uppercase text-text-primary hover:bg-surface-2"
                >
                  {format}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
