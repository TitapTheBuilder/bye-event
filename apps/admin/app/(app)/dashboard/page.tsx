"use client";

import { formatPersonName } from "@repo/shared/person-name";
import { useEffect, useState } from "react";
import { DashboardVisitorsTable } from "@/components/DashboardVisitorsTable";
import { LeaderboardChart } from "@/components/LeaderboardChart";
import { useTranslation } from "@/lib/client/language-context";

interface DashboardSummary {
  totalVisitors: number;
  invitedCount: number;
  guestCount: number;
  totalExhibitors: number;
  totalVisits: number;
}

interface LeaderboardRow {
  exhibitorId: string;
  exhibitorFirstName: string;
  exhibitorLastName: string;
  totalVisits: number;
  totalScans: number;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-text-primary" suppressHydrationWarning>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setSummary(data.summary);
      setLeaderboard(data.leaderboard);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topLeaderboard = leaderboard
    .filter((row) => row.totalScans > 0)
    .slice(0, 8)
    .map((row) => ({
      exhibitorName: formatPersonName(row.exhibitorFirstName, row.exhibitorLastName),
      totalScans: row.totalScans,
    }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{t("dashboard.title")}</h1>
        <p className="text-sm text-text-secondary">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label={t("dashboard.totalVisitors")} value={summary?.totalVisitors ?? 0} />
        <SummaryCard label={t("dashboard.invited")} value={summary?.invitedCount ?? 0} />
        <SummaryCard label={t("dashboard.guests")} value={summary?.guestCount ?? 0} />
        <SummaryCard label={t("dashboard.exhibitors")} value={summary?.totalExhibitors ?? 0} />
        <SummaryCard label={t("dashboard.totalVisits")} value={summary?.totalVisits ?? 0} />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {t("dashboard.leaderboard")}
        </h2>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-secondary">{t("common.loading")}</p>
        ) : (
          <LeaderboardChart data={topLeaderboard} />
        )}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {t("dashboard.visitors")}
        </h2>
        <DashboardVisitorsTable />
      </div>
    </div>
  );
}
