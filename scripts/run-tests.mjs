import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(process.cwd(), process.argv[2] ?? "src");
const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return collectTests(path);
  return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
}).sort();

const files = collectTests(root);
if (files.length === 0) {
  console.log(`No test files found under ${root}.`);
  process.exit(0);
}

const tsxCli = resolve(fileURLToPath(new URL(".", import.meta.url)), "../node_modules/tsx/dist/cli.mjs");
const result = spawnSync(process.execPath, [tsxCli, "--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
