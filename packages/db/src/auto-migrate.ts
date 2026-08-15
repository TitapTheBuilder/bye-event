import { client } from "./client";

/**
 * Automatically creates all tables, columns, indexes, and initial records
 * if they do not exist. Called on application startup (instrumentation hook)
 * so that production deployments automatically stay in sync with the Drizzle
 * schema without requiring manual SQL queries.
 */
export async function ensureSchema(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const statements = [
    `DO $$ BEGIN
      CREATE TYPE visitor_type AS ENUM ('invited', 'guest');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      key text PRIMARY KEY NOT NULL,
      request_count integer DEFAULT 1 NOT NULL,
      expires_at timestamp with time zone NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_at_idx ON rate_limit_buckets (expires_at);`,

    `CREATE TABLE IF NOT EXISTS uploads (
      path text PRIMARY KEY NOT NULL,
      content_type varchar(100) NOT NULL,
      data bytea NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS event_settings (
      id integer PRIMARY KEY DEFAULT 1 NOT NULL,
      business_name varchar(200),
      logo_url text,
      primary_color varchar(7),
      secondary_color varchar(7),
      accent_color varchar(7),
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `INSERT INTO event_settings (id, business_name) VALUES (1, 'Exhibition System') ON CONFLICT (id) DO NOTHING;`,

    `CREATE TABLE IF NOT EXISTS admins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name varchar(200) NOT NULL,
      email varchar(200) UNIQUE NOT NULL,
      password_hash text NOT NULL,
      session_version integer DEFAULT 0 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `ALTER TABLE admins ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 0 NOT NULL;`,

    `CREATE TABLE IF NOT EXISTS exhibitors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      first_name varchar(200) NOT NULL,
      last_name varchar(200) NOT NULL,
      username varchar(100) UNIQUE NOT NULL,
      password_hash text NOT NULL,
      phone_number varchar(30) UNIQUE NOT NULL,
      session_version integer DEFAULT 0 NOT NULL,
      deactivated_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS first_name varchar(200);`,
    `ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS last_name varchar(200);`,
    `ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 0 NOT NULL;`,

    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exhibitors' AND column_name = 'name') THEN
        UPDATE exhibitors SET first_name = COALESCE(NULLIF(BTRIM(name), ''), 'Exhibitor'), last_name = COALESCE(last_name, '') WHERE first_name IS NULL;
        ALTER TABLE exhibitors ALTER COLUMN name DROP NOT NULL;
        ALTER TABLE exhibitors DROP COLUMN IF EXISTS name;
      END IF;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS visitors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      qr_token varchar(64) UNIQUE NOT NULL,
      short_code varchar(10) UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 6),
      first_name varchar(200),
      last_name varchar(200),
      company varchar(200),
      phone_number varchar(30),
      email varchar(200),
      visitor_type visitor_type DEFAULT 'invited' NOT NULL,
      deactivated_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `ALTER TABLE visitors ADD COLUMN IF NOT EXISTS first_name varchar(200);`,
    `ALTER TABLE visitors ADD COLUMN IF NOT EXISTS last_name varchar(200);`,
    `ALTER TABLE visitors ADD COLUMN IF NOT EXISTS short_code varchar(10) NOT NULL DEFAULT substring(md5(random()::text), 1, 6);`,

    `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitors' AND column_name = 'name') THEN
        UPDATE visitors SET first_name = COALESCE(NULLIF(BTRIM(name), ''), first_name) WHERE first_name IS NULL;
        ALTER TABLE visitors ALTER COLUMN name DROP NOT NULL;
        ALTER TABLE visitors DROP COLUMN IF EXISTS name;
      END IF;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE visitors ADD CONSTRAINT visitors_short_code_unique UNIQUE (short_code);
    EXCEPTION
      WHEN duplicate_table THEN null;
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE INDEX IF NOT EXISTS visitors_deactivated_at_idx ON visitors (deactivated_at);`,

    `CREATE TABLE IF NOT EXISTS visits (
      exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),
      visitor_id uuid NOT NULL REFERENCES visitors(id),
      scan_count integer DEFAULT 1 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      last_scanned_at timestamp with time zone DEFAULT now() NOT NULL,
      PRIMARY KEY (exhibitor_id, visitor_id)
    );`,

    `CREATE INDEX IF NOT EXISTS visits_visitor_id_idx ON visits (visitor_id);`,

    `CREATE TABLE IF NOT EXISTS visit_sync_events (
      local_id uuid PRIMARY KEY NOT NULL,
      exhibitor_id uuid NOT NULL REFERENCES exhibitors(id),
      visitor_id uuid NOT NULL REFERENCES visitors(id),
      scanned_at timestamp with time zone NOT NULL,
      processed_at timestamp with time zone DEFAULT now() NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS visit_sync_events_exhibitor_id_idx ON visit_sync_events (exhibitor_id);`,
    `CREATE INDEX IF NOT EXISTS visit_sync_events_visitor_id_idx ON visit_sync_events (visitor_id);`,
  ];

  try {
    for (const statement of statements) {
      await client.unsafe(statement);
    }
  } catch (err) {
    console.error("Auto schema initialization check error:", err);
  }
}
