import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { Box3, Vector3, MeshStandardMaterial } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// GLTFExporter uses this browser API for its binary buffers. No image decoding is required:
// the licensed PNG atlas is copied beside the GLB and assigned by the runtime loader.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`; this.onloadend?.(); });
  }
};

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/assets/import-kenney-character.mjs <extracted Kenney pack directory>");
const destination = resolve("apps/web/public/assets/community/kenney-protagonist");
const parse = async (file) => {
  const bytes = await readFile(join(source, file));
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), `${source}/`);
};
const character = await parse("Model/characterMedium.fbx");
character.name = "KenneyProtagonist";
const nodeNames = new Set();
let triangles = 0;
character.traverse((object) => {
  nodeNames.add(object.name);
  if (!object.isMesh) return;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  object.material = new MeshStandardMaterial({ name: "skin", roughness: .85, metalness: 0 });
});
const animations = [];
for (const name of ["idle", "run", "jump"]) {
  const animationSource = await parse(`Animations/${name}.fbx`);
  const clip = animationSource.animations.find((item) => item.name.toLowerCase().endsWith(`|${name}`));
  if (!clip) throw new Error(`Missing ${name} animation`);
  const copy = clip.clone();
  copy.name = name;
  // The authoritative controller owns locomotion and jump translation. Never export root motion.
  copy.tracks = copy.tracks.filter((track) => nodeNames.has(track.name.split(".")[0])
    && !/^(Root|HipsCtrl|Hips)\.position$/.test(track.name));
  if (!copy.tracks.length) throw new Error(`No usable ${name} animation tracks`);
  animations.push(copy);
}
character.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(character);
const height = bounds.getSize(new Vector3()).y;
if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid character bounds");
character.scale.multiplyScalar(2.05 / height);
character.updateMatrixWorld(true);
const normalizedBounds = new Box3().setFromObject(character);
character.position.y -= normalizedBounds.min.y;
const result = await new GLTFExporter().parseAsync(character, { binary: true, animations, onlyVisible: true });
await mkdir(destination, { recursive: true });
const bytes = Buffer.from(result);
await writeFile(join(destination, "character.glb"), bytes);
await copyFile(join(source, "Skins/skaterMaleA.png"), join(destination, "skater.png"));
await copyFile(join(source, "License.txt"), join(destination, "LICENSE.txt"));
await writeFile(join(destination, "provenance.json"), JSON.stringify({
  source: "https://kenney.nl/assets/animated-characters-protagonists", license: "CC0-1.0",
  importer: "scripts/assets/import-kenney-character.mjs", three: "0.178.0", triangles,
  height: 2.05, clips: animations.map((clip) => ({ name: clip.name, tracks: clip.tracks.length })),
  sha256: createHash("sha256").update(bytes).digest("hex")
}, null, 2) + "\n");
console.log(`Imported ${triangles} triangles, ${animations.length} clips, ${bytes.length} bytes -> ${destination}`);
