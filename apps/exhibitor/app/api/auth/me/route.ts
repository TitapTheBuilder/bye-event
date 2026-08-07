import { db, getExhibitorById } from "@repo/db";
import { getExhibitorSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getExhibitorSession();
  if (!session) return NextResponse.json({ exhibitor: null });

  const exhibitor = await getExhibitorById(db, session.exhibitorId);
  if (!exhibitor || exhibitor.deactivatedAt) return NextResponse.json({ exhibitor: null });

  return NextResponse.json({
    exhibitor: {
      id: exhibitor.id,
      name: exhibitor.name,
      username: exhibitor.username,
      phoneNumber: exhibitor.phoneNumber,
    },
  });
}
