import { validateExhibitorEnvironment } from "@/lib/env";
import { ensureSchema } from "@repo/db";

export async function register() {
  validateExhibitorEnvironment();
  await ensureSchema();
}

