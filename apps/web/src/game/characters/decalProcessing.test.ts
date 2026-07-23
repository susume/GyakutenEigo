import test from "node:test";
import assert from "node:assert/strict";
import { DECAL_MAX_SOURCE_BYTES } from "@quizstrike/shared";
import { validateDecalFile } from "./decalProcessing.js";

test("decal source validation accepts supported classroom artwork formats", () => {
  assert.equal(validateDecalFile({ type: "image/png", size: 1024 } as File), undefined);
  assert.equal(validateDecalFile({ type: "image/jpeg", size: 2048 } as File), undefined);
  assert.equal(validateDecalFile({ type: "image/webp", size: 2048 } as File), undefined);
});

test("decal source validation rejects unsupported and oversized files", () => {
  assert.match(validateDecalFile({ type: "image/svg+xml", size: 1024 } as File) ?? "", /PNG/);
  assert.match(validateDecalFile({ type: "image/png", size: DECAL_MAX_SOURCE_BYTES + 1 } as File) ?? "", /5 MB/);
});
