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

export async function getEventSettings(db: Database): Promise<EventSettings> {
  const [row] = await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1);
  if (row) return row;
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
  return row;
}
