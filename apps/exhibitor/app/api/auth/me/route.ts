import { db, getExhibitorById } from "@repo/db";
import { NextResponse } from "next/server";
import { getExhibitorSession } from "@/lib/session";

export async function GET() {
  const session = await getExhibitorSession();
  if (!session) return NextResponse.json({ exhibitor: null });

  const exhibitor = await getExhibitorById(db, session.exhibitorId);
  if (!exhibitor || exhibitor.deactivatedAt) return NextResponse.json({ exhibitor: null });

  return NextResponse.json({
    exhibitor: {
      id: exhibitor.id,
      firstName: exhibitor.firstName,
      lastName: exhibitor.lastName,
      username: exhibitor.username,
      phoneNumber: exhibitor.phoneNumber,
    },
  });
}
