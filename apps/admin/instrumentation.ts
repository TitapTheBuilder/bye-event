import { validateAdminEnvironment } from "@/lib/env";

export function register() {
  validateAdminEnvironment();
}
