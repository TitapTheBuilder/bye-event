"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface LeaderboardDatum {
  exhibitorName: string;
  totalScans: number;
}

/**
 * Exhibitor leaderboard by scan count (§7). Uses the CSS custom property
 * for the brand accent color so the chart re-themes with the rest of the
 * white-label palette, never a hardcoded color.
 */
export function LeaderboardChart({ data }: { data: LeaderboardDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-secondary">
        No scans recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="exhibitorName"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            color: "var(--text-primary)",
          }}
          cursor={{ fill: "var(--surface-2)" }}
        />
        <Bar dataKey="totalScans" name="Total scans" fill="var(--brand-accent)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
