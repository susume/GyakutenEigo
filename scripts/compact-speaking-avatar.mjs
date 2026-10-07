import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Losslessly recompress embedded PNGs without a glTF exporter (which could
// discard VRM extensions). Preserve every non-image buffer view byte-for-byte.
const [input, output] = process.argv.slice(2);
assert.ok(input && output, "Usage: node scripts/compact-speaking-avatar.mjs source.vrm output.vrm");
const source = readFileSync(input);
assert.equal(source.toString("ascii", 0, 4), "glTF");
assert.equal(source.readUInt32LE(4), 2);
assert.equal(source.readUInt32LE(8), source.length);
assert.equal(source.readUInt32LE(16), 0x4e4f534a);
const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
assert.equal(source.readUInt32LE(24 + jsonLength), 0x004e4942);
assert.equal(json.buffers.length, 1, "Only self-contained, single-buffer VRMs are supported");
assert.ok(!json.buffers[0].uri);
const binary = source.subarray(28 + jsonLength);
const replacements = new Map();
for (const image of json.images) {
  assert.ok(image.bufferView !== undefined && !image.uri, "All images must be embedded");
  if (image.mimeType !== "image/png") continue;
  const view = json.bufferViews[image.bufferView];
  const original = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const before = await sharp(original).raw().toBuffer({ resolveWithObject: true });
  // Encode the decoded samples explicitly, avoiding colour conversion through
  // Sharp's normal image-to-image pipeline.
  const compressed = await sharp(before.data, { raw: {
    width: before.info.width, height: before.info.height, channels: before.info.channels
  } }).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  const after = await sharp(compressed).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(after.info, before.info, `Image dimensions/channels changed: ${image.name}`);
  assert.ok(after.data.equals(before.data), `Image pixels changed: ${image.name}`);
  if (compressed.length < original.length) replacements.set(image.bufferView, compressed);
}

const parts = [];
let byteOffset = 0;
for (const [index, view] of json.bufferViews.entries()) {
  assert.equal(view.buffer, 0);
  const original = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const bytes = replacements.get(index) ?? original;
  view.byteOffset = byteOffset;
  view.byteLength = bytes.length;
  parts.push(bytes);
  const padding = (4 - bytes.length % 4) % 4;
  if (padding) parts.push(Buffer.alloc(padding));
  byteOffset += bytes.length + padding;
}
json.buffers[0].byteLength = byteOffset;
const jsonBytes = Buffer.from(JSON.stringify(json));
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
const binaryBytes = Buffer.concat(parts);
const header = Buffer.alloc(20);
header.write("glTF", 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + paddedJson.length + binaryBytes.length, 8);
header.writeUInt32LE(paddedJson.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binaryBytes.length, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, paddedJson, binaryHeader, binaryBytes]);
writeFileSync(output, result);
console.log(JSON.stringify({ sourceBytes: source.length, installedBytes: result.length,
  losslesslyCompressedImages: replacements.size,
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  installedSha256: createHash("sha256").update(result).digest("hex") }, null, 2));
