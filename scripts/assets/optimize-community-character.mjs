import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const folder = resolve("apps/web/public/assets/community/kenney-protagonist");
const cli = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
const temp = await mkdtemp(join(tmpdir(), "quizstrike-gltf-"));
const source = join(folder, "character.glb");
const resampled = join(temp, "resampled.glb");
const compressed = join(temp, "compressed.glb");
for (const args of [["resample", source, resampled], ["meshopt", resampled, compressed]]) {
  const result = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`glTF Transform ${args[0]} failed`);
}
const bytes = await readFile(compressed);
await writeFile(source, bytes);
const provenancePath = join(folder, "provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
provenance.optimization = { tool: "@gltf-transform/cli", version: "4.5.1", transforms: ["resample", "meshopt"] };
provenance.sha256 = createHash("sha256").update(bytes).digest("hex");
provenance.bytes = bytes.length;
await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
console.log(`Optimized character: ${bytes.length} bytes. MeshoptDecoder is required at runtime.`);
