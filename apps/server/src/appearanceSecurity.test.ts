import test from "node:test";
import assert from "node:assert/strict";
import { DECAL_MAX_PROCESSED_BYTES } from "@quizstrike/shared";
import { inspectProcessedDecal } from "./appearanceSecurity.js";

test("processed decal inspection matches declared PNG and WebP signatures", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS0AAAAASUVORK5CYII=", "base64");
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode("RIFF"), 0);
  webp.set(new TextEncoder().encode("WEBPVP8X"), 8);
  assert.equal(inspectProcessedDecal(png, "image/png"), "image/png");
  assert.equal(inspectProcessedDecal(webp, "image/webp"), "image/webp");
});

test("processed decal inspection rejects spoofed and oversized content", () => {
  assert.equal(inspectProcessedDecal(new TextEncoder().encode("not an image"), "image/png"), undefined);
  assert.equal(inspectProcessedDecal(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), "image/webp"), undefined);
  assert.equal(inspectProcessedDecal(new Uint8Array(DECAL_MAX_PROCESSED_BYTES + 1), "image/png"), undefined);
});
