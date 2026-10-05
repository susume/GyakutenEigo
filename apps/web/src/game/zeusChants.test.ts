import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ZEUS_CHANTS } from "@quizstrike/shared";

test("bundled narration durations agree with the authoritative turn deadlines", () => {
  for (const [id, chant] of Object.entries(ZEUS_CHANTS)) {
    const wav = readFileSync(new URL(`../../public${chant.path}`, import.meta.url));
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    let bytesPerSecond = 0;
    let dataSize = 0;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const size = wav.readUInt32LE(offset + 4);
      const chunk = wav.toString("ascii", offset, offset + 4);
      if (chunk === "fmt ") bytesPerSecond = wav.readUInt32LE(offset + 16);
      if (chunk === "data") dataSize = size;
      offset += 8 + size + size % 2;
    }
    assert.ok(bytesPerSecond > 0 && dataSize > 0);
    assert.ok(Math.abs(dataSize / bytesPerSecond * 1000 - chant.durationMs) < 1, `${id} must finish before Zeus turns`);
  }
});
