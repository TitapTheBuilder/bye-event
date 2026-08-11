import { isDatabaseReady } from "@repo/db";
import { NextResponse } from "next/server";

export async function GET() {
  const ready = await isDatabaseReady();
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
