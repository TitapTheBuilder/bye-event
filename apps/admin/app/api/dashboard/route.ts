import { db, getDashboardSummary, getExhibitorLeaderboard } from "@repo/db";
import { unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/** Summary counts + exhibitor leaderboard for the admin dashboard (§7). */
export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const [summary, leaderboard] = await Promise.all([
    getDashboardSummary(db),
    getExhibitorLeaderboard(db),
  ]);

  return NextResponse.json({ summary, leaderboard });
}
