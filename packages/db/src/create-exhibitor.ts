import "./env";
import { hashPassword } from "@repo/shared/auth";
import { db } from "./client";
import { createExhibitor, getExhibitorByUsername } from "./exhibitors";

/**
 * Creates a new exhibitor user account.
 * This is intended for production/operational use to provision exhibitor
 * accounts since they may not be able to self-register.
 *
 * Usage:
 *   EXHIBITOR_FIRST_NAME="Jane" EXHIBITOR_LAST_NAME="Doe" \
 *   EXHIBITOR_USERNAME="janedoe" EXHIBITOR_PASSWORD="securepassword" \
 *   EXHIBITOR_PHONE="+1234567890" \
 *   pnpm --filter @repo/db create-exhibitor
 */
async function main() {
  const firstName = process.env.EXHIBITOR_FIRST_NAME;
  const lastName = process.env.EXHIBITOR_LAST_NAME;
  const username = process.env.EXHIBITOR_USERNAME;
  const password = process.env.EXHIBITOR_PASSWORD;
  const phoneNumber = process.env.EXHIBITOR_PHONE ?? "";

  if (!firstName || !lastName || !username || !password) {
    console.error(
      "EXHIBITOR_FIRST_NAME, EXHIBITOR_LAST_NAME, EXHIBITOR_USERNAME, and EXHIBITOR_PASSWORD are required.",
    );
    process.exit(1);
  }

  const existing = await getExhibitorByUsername(db, username);
  if (existing) {
    console.log(`Exhibitor ${username} already exists -- nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  const exhibitor = await createExhibitor(db, {
    firstName,
    lastName,
    username,
    phoneNumber,
    passwordHash,
  });
  console.log(`Created exhibitor ${exhibitor.username} (${exhibitor.id}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create exhibitor:", err);
  process.exit(1);
});
