export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateAdminEnvironment } = await import("@/lib/env");
    const { ensureSchema } = await import("@repo/db");
    validateAdminEnvironment();
    await ensureSchema();
  }
}


