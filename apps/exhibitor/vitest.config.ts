import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    exclude: ["**/.next/**", "**/node_modules/**"],
    env: {
      DATABASE_URL: "postgres://build:build@127.0.0.1:5432/build"
    },
    setupFiles: ["./vitest.setup.ts"],
  },
});
