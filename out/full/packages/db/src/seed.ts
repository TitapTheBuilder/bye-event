import "dotenv/config";
import { hashPassword } from "@repo/shared/auth";
import { createAdmin, getAdminByEmail } from "./admins";
import { db } from "./client";

/**
 * Bootstraps the very first admin account. Admins can't self-signup by
 * design (every admin account is created by another admin, from day one
 * supporting multiple distinct accounts) -- so a brand-new deployment
 * needs exactly one chicken-and-egg escape hatch. Run once per
 * deployment:
 *
 *   ADMIN_NAME="Ada Lovelace" ADMIN_EMAIL="ada@example.com" \
 *     ADMIN_PASSWORD="change-me-now" pnpm --filter @repo/db seed
 */
async function main() {
  const name = process.env.ADMIN_NAME ?? "Admin";
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required to seed an admin.");
    process.exit(1);
  }

  const existing = await getAdminByEmail(db, email);
  if (existing) {
    console.log(`Admin ${email} already exists -- nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  const admin = await createAdmin(db, { name, email, passwordHash });
  console.log(`Created admin ${admin.email} (${admin.id}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
