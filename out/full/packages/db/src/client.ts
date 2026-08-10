import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __exhibitionDbClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(connectionString, { max: 10 });
}

// Reuse the connection across Next.js dev hot-reloads instead of exhausting
// Postgres connections on every file save.
const client = globalThis.__exhibitionDbClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__exhibitionDbClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
