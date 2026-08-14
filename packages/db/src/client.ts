import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __exhibitionDbClient: ReturnType<typeof postgres> | undefined;
}

function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function requireSecureProductionDatabase(connectionString: string): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_INSECURE_DATABASE === "1" ||
    isNextProductionBuild()
  ) {
    return;
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(
      "Production DATABASE_URL must use sslmode=verify-full (or explicitly set ALLOW_INSECURE_DATABASE=1 for a private, single-host deployment)",
    );
  }
}

function createClient() {
  const connectionString =
    process.env.DATABASE_URL ??
    (isNextProductionBuild() ? "postgres://build:build@127.0.0.1:5432/build" : undefined);
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  requireSecureProductionDatabase(connectionString);

  return postgres(connectionString, {
    max: Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "10", 10),
    connect_timeout: 5,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
  });
}

// Reuse the connection across Next.js dev hot-reloads instead of exhausting
// Postgres connections on every file save.
export const client = globalThis.__exhibitionDbClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__exhibitionDbClient = client;
}

export async function isDatabaseReady(): Promise<boolean> {
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  }
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
