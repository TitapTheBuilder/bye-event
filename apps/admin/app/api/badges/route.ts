import { db, getEventSettings, getVisitorsByIds, listAllVisitorsForExport } from "@repo/db";
import { badgeExportSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { generateBadgePdf } from "@/lib/pdf/badges";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Print-ready badge PDF export (§7): two distinct templates (invited:
 * name + company + QR; guest: QR only). QR generation/mapping is fully
 * automatic -- every visitor already has a qr_token from creation, this
 * route just renders it.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = badgeExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { visitorType, visitorIds } = parsed.data;
  const visitors = visitorIds
    ? (await getVisitorsByIds(db, visitorIds)).filter((v) => v.visitorType === visitorType)
    : await listAllVisitorsForExport(db, { visitorType });

  if (visitors.length === 0) {
    return NextResponse.json({ error: "No matching visitors to generate badges for" }, { status: 400 });
  }

  const eventSettings = await getEventSettings(db);
  const pdfBuffer = await generateBadgePdf({ visitorType, visitors, eventSettings });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${visitorType}-badges.pdf"`,
    },
  });
}
