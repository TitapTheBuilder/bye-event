import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { clearAdminSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
