import "./env";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATION_LOCK_ID = 70_226_001;
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATION_DATABASE_URL is not set");
  }

  const migrationClient = postgres(connectionString, { max: 1, connect_timeout: 10 });
  try {
    await migrationClient`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    console.log("Running database migrations...");
    await migrate(drizzle(migrationClient), { migrationsFolder });
    console.log("Database migrations complete.");
  } finally {
    await migrationClient`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`.catch(() => undefined);
    await migrationClient.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
