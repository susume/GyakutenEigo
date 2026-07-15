import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (databaseUrl) {
  const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../prisma/schema.prisma");
  const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const migration = spawnSync(prismaCommand, ["prisma", "migrate", "deploy", "--schema", schemaPath], {
    env: process.env,
    stdio: "inherit"
  });

  if (migration.error || migration.status !== 0) {
    process.exit(migration.status ?? 1);
  }
} else {
  console.warn("DATABASE_URL is not configured; starting QuizStrike with in-memory storage.");
}

await import("./index.js");
