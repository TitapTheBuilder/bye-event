export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateExhibitorEnvironment } = await import("@/lib/env");
    const { ensureSchema } = await import("@repo/db");
    validateExhibitorEnvironment();
    await ensureSchema();
  }
}


