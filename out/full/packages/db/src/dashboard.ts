import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { exhibitors, visitors } from "./schema";
import { countTotalVisits } from "./visits";

export interface DashboardSummary {
  totalVisitors: number;
  invitedCount: number;
  guestCount: number;
  totalExhibitors: number;
  totalVisits: number;
}

export async function getDashboardSummary(db: Database): Promise<DashboardSummary> {
  const [totalVisitors, invitedCount, guestCount, totalExhibitors, totalVisits] =
    await Promise.all([
      db.$count(visitors, isNull(visitors.deactivatedAt)),
      db.$count(
        visitors,
        and(isNull(visitors.deactivatedAt), eq(visitors.visitorType, "invited")),
      ),
      db.$count(visitors, and(isNull(visitors.deactivatedAt), eq(visitors.visitorType, "guest"))),
      db.$count(exhibitors, isNull(exhibitors.deactivatedAt)),
      countTotalVisits(db),
    ]);

  return { totalVisitors, invitedCount, guestCount, totalExhibitors, totalVisits };
}
