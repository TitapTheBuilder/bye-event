import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __exhibitionDbClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __exhibitionDbInitPromise: Promise<void> | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(connectionString, {
    max: 10,
    connect_timeout: 5, // Fail fast in 5 seconds if DB is unreachable instead of hanging proxy
    idle_timeout: 30,
  });
}

// Reuse the connection across Next.js dev hot-reloads instead of exhausting
// Postgres connections on every file save.
const client = globalThis.__exhibitionDbClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__exhibitionDbClient = client;
}

// Auto-create missing database tables in background without blocking SSR requests
async function ensureTables() {
  try {
    await client`
      DO $$ BEGIN
        CREATE TYPE visitor_type AS ENUM ('invited', 'guest');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      CREATE TABLE IF NOT EXISTS event_settings (
        id integer PRIMARY KEY DEFAULT 1,
        business_name varchar(200),
        logo_url text,
        primary_color varchar(7),
        secondary_color varchar(7),
        accent_color varchar(7),
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await client`
      INSERT INTO event_settings (id, business_name) VALUES (1, 'Exhibition System') ON CONFLICT DO NOTHING;
    `;
    await client`
      CREATE TABLE IF NOT EXISTS admins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name varchar(200) NOT NULL,
        email varchar(200) UNIQUE NOT NULL,
        password_hash text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS exhibitors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name varchar(200) NOT NULL,
        username varchar(100) UNIQUE NOT NULL,
        password_hash text NOT NULL,
        phone_number varchar(30) UNIQUE NOT NULL,
        deactivated_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS visitors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        qr_token varchar(64) UNIQUE NOT NULL,
        name varchar(200),
        company varchar(200),
        phone_number varchar(30),
        email varchar(200),
        visitor_type visitor_type DEFAULT 'invited' NOT NULL,
        deactivated_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS visits (
        exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),
        visitor_id uuid NOT NULL REFERENCES visitors(id),
        scan_count integer DEFAULT 1 NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        last_scanned_at timestamp with time zone DEFAULT now() NOT NULL,
        PRIMARY KEY (exhibitor_id, visitor_id)
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS uploads (
        path text PRIMARY KEY NOT NULL,
        content_type varchar(100) NOT NULL,
        data bytea NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS visit_sync_events (
        local_id uuid PRIMARY KEY NOT NULL,
        exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),
        visitor_id uuid NOT NULL REFERENCES visitors(id),
        scanned_at timestamp with time zone NOT NULL,
        processed_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
  } catch (err) {
    console.error("Auto table initialization check error:", err);
  }
}

if (!globalThis.__exhibitionDbInitPromise) {
  // Fire and forget: run in background so it never blocks HTTP request handling
  globalThis.__exhibitionDbInitPromise = ensureTables();
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
