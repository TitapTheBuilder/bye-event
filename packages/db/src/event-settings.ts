import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { type EventSettings, eventSettings } from "./schema";

export const UNIVERSITY_OF_TEHRAN_CREDIT = "University of Tehran" as const;

/**
 * Defaults used until an admin uploads a logo/colors. These are neutral
 * placeholders, not a specific customer's brand -- component code must
 * never hardcode a real customer's colors.
 */
const DEFAULTS: Omit<EventSettings, "id" | "updatedAt"> = {
  businessName: null,
  logoUrl: null,
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  accentColor: "#22d3ee",
};

/**
 * Logos are stored as origin-relative `/uploads/...` paths so each app
 * resolves them against the host the browser is actually on. Older rows
 * were written with an absolute origin baked in (from a since-removed
 * ADMIN_PUBLIC_URL setting), which renders as a broken image anywhere that
 * origin isn't reachable -- most obviously a `localhost` URL opened from a
 * phone. Strip it back to the path so those deployments heal on read
 * instead of needing the logo uploaded again.
 */
export function toRelativeUploadUrl(url: string | null): string | null {
  if (!url) return url;
  const match = /^https?:\/\/[^/]+(\/uploads\/.+)$/.exec(url);
  return match?.[1] ?? url;
}

export async function getEventSettings(db: Database): Promise<EventSettings> {
  const [row] = await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1);
  if (row) return { ...row, logoUrl: toRelativeUploadUrl(row.logoUrl) };
  return { id: 1, updatedAt: new Date(), ...DEFAULTS };
}

export interface UpsertEventSettingsInput {
  businessName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}

export async function upsertEventSettings(
  db: Database,
  input: UpsertEventSettingsInput,
): Promise<EventSettings> {
  const [row] = await db
    .insert(eventSettings)
    .values({ id: 1, ...DEFAULTS, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: eventSettings.id,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert event settings");
  return { ...row, logoUrl: toRelativeUploadUrl(row.logoUrl) };
}
