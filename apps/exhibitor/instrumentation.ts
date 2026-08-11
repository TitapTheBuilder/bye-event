import { validateExhibitorEnvironment } from "@/lib/env";

export function register() {
  validateExhibitorEnvironment();
}
