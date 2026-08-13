import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const possibleEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(fileURLToPath(new URL("../.env", import.meta.url))),
  resolve(fileURLToPath(new URL("../../.env", import.meta.url))),
  resolve(fileURLToPath(new URL("../../../.env", import.meta.url))),
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}
