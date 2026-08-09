import "dotenv/config";
import { hashPassword } from "@repo/shared/auth";
import { createExhibitor, getExhibitorByUsername } from "./exhibitors";
import { db } from "./client";

/**
 * Creates a new exhibitor user account.
 * This is intended for production/operational use to provision exhibitor
 * accounts since they may not be able to self-register.
 * 
 * Usage:
 *   EXHIBITOR_NAME="Tech Corp" EXHIBITOR_USERNAME="techcorp" \
 *   EXHIBITOR_PASSWORD="securepassword" EXHIBITOR_PHONE="+1234567890" \
 *   pnpm --filter @repo/db create-exhibitor
 */
async function main() {
  const name = process.env.EXHIBITOR_NAME;
  const username = process.env.EXHIBITOR_USERNAME;
  const password = process.env.EXHIBITOR_PASSWORD;
  const phoneNumber = process.env.EXHIBITOR_PHONE ?? "";

  if (!name || !username || !password) {
    console.error("EXHIBITOR_NAME, EXHIBITOR_USERNAME, and EXHIBITOR_PASSWORD env vars are required.");
    process.exit(1);
  }

  const existing = await getExhibitorByUsername(db, username);
  if (existing) {
    console.log(`Exhibitor ${username} already exists -- nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  const exhibitor = await createExhibitor(db, { name, username, phoneNumber, passwordHash });
  console.log(`Created exhibitor ${exhibitor.username} (${exhibitor.id}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create exhibitor:", err);
  process.exit(1);
});
