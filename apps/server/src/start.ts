import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "./config.js";

const databaseUrl = loadServerConfig().databaseUrl;

if (databaseUrl) {
  const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../prisma/schema.prisma");
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
    env: process.env,
    stdio: "inherit"
  });

  if (migration.error) throw migration.error;
  if (migration.status !== 0) process.exit(migration.status ?? 1);
} else if (process.env.NODE_ENV !== "production") {
  console.warn("DATABASE_URL is not configured; starting QuizStrike with in-memory storage.");
}

await import("./index.js");
