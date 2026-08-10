import { countVisitors, createVisitor, db, listVisitors, type ListVisitorsOptions } from "@repo/db";
import { visitorCreateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") ?? undefined;
  const visitorTypeParam = searchParams.get("visitorType");
  const visitorType = visitorTypeParam === "invited" || visitorTypeParam === "guest" ? visitorTypeParam : undefined;
  const includeDeactivated = searchParams.get("includeDeactivated") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "25") || 25));
  const sortByParam = searchParams.get("sortBy");
  const sortBy = sortByParam === "name" || sortByParam === "company" ? sortByParam : "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const options: Pick<
    ListVisitorsOptions,
    "search" | "visitorType" | "includeDeactivated" | "sortBy" | "sortDir"
  > = { search, visitorType, includeDeactivated, sortBy, sortDir };

  const [visitors, total] = await Promise.all([
    listVisitors(db, { ...options, limit: pageSize, offset: (page - 1) * pageSize }),
    countVisitors(db, options),
  ]);

  return NextResponse.json({ visitors, total, page, pageSize });
}

/** Manual "add visitor" form -- goes through the shared createVisitor
 * helper in @repo/db, which is the only path allowed to assign qr_token. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = visitorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const visitor = await createVisitor(db, parsed.data);
  return NextResponse.json({ visitor }, { status: 201 });
}
