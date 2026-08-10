import { relations, sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * Single source of truth for the database schema. Never redeclare any of
 * these tables (or run a raw-SQL migration not reflected here) inside
 * apps/exhibitor or apps/admin — both apps import exclusively from
 * @repo/db.
 */

export const visitorTypeEnum = pgEnum("visitor_type", ["invited", "guest"]);

export const exhibitors = pgTable("exhibitors", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  firstName: varchar("first_name", { length: 200 }).notNull(),
  lastName: varchar("last_name", { length: 200 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull().unique(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitors = pgTable(
  "visitors",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    // Independently-random from `id` on purpose: this is the value printed
    // on the badge and scanned by anyone, so it must never leak creation
    // order (which uuidv7 does) or be enumerable (which a serial int would
    // be). Never derive this from `id`.
    qrToken: varchar("qr_token", { length: 64 }).notNull().unique(),
    firstName: varchar("first_name", { length: 200 }),
    lastName: varchar("last_name", { length: 200 }),
    company: varchar("company", { length: 200 }),
    phoneNumber: varchar("phone_number", { length: 30 }),
    email: varchar("email", { length: 200 }),
    visitorType: visitorTypeEnum("visitor_type").notNull().default("invited"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visitors_deactivated_at_idx").on(t.deactivatedAt)],
);

export const visits = pgTable(
  "visits",
  {
    exhibitorId: uuid("exhibitor_id")
      .notNull()
      .references(() => exhibitors.id),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id),
    scanCount: integer("scan_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.exhibitorId, t.visitorId] }),
    // Reverse lookup: "which exhibitors scanned this visitor" (admin dashboard).
    index("visits_visitor_id_idx").on(t.visitorId),
  ],
);

export const visitSyncEvents = pgTable(
  "visit_sync_events",
  {
    localId: uuid("local_id").primaryKey(),
    exhibitorId: uuid("exhibitor_id")
      .notNull()
      .references(() => exhibitors.id),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("visit_sync_events_exhibitor_id_idx").on(t.exhibitorId),
    index("visit_sync_events_visitor_id_idx").on(t.visitorId),
  ],
);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Singleton row (id is always 1). Both apps read this at render time to
// derive brand CSS custom properties -- never hardcode a customer's colors
// in component code.
export const eventSettings = pgTable("event_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: varchar("business_name", { length: 200 }),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  secondaryColor: varchar("secondary_color", { length: 7 }),
  accentColor: varchar("accent_color", { length: 7 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admin-uploaded binary assets (currently just the customer logo), stored
 * in the database rather than on local disk.
 *
 * The admin and exhibitor apps run as separate containers that are NOT
 * guaranteed to share a filesystem -- the app Dockerfiles build
 * self-contained single-container images, and only docker-compose happens
 * to wire up a shared uploads volume. What they always share is this
 * database, so that is where the bytes belong: an asset uploaded in admin
 * is then readable by the exhibitor app in every deployment topology.
 *
 * `path` is the URL path relative to /uploads/ (e.g. "logos/abc123.png"),
 * which is exactly what event_settings.logo_url points at.
 */
export const uploads = pgTable("uploads", {
  path: text("path").primaryKey(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exhibitorsRelations = relations(exhibitors, ({ many }) => ({
  visits: many(visits),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  visits: many(visits),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  exhibitor: one(exhibitors, {
    fields: [visits.exhibitorId],
    references: [exhibitors.id],
  }),
  visitor: one(visitors, {
    fields: [visits.visitorId],
    references: [visitors.id],
  }),
}));

export type Exhibitor = typeof exhibitors.$inferSelect;
export type NewExhibitor = typeof exhibitors.$inferInsert;
export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type VisitSyncEvent = typeof visitSyncEvents.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type EventSettings = typeof eventSettings.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
