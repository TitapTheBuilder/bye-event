import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { clearExhibitorSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();
  await clearExhibitorSession();
  return NextResponse.json({ ok: true });
}
