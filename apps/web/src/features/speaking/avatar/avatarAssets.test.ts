import assert from "node:assert/strict";
import test from "node:test";
import { localAvatarUrl } from "./SpeakingAvatarRenderer.js";

test("avatar assets stay on the application origin, with relative local resources supported", () => {
  const base = "https://school.example/assets/speaking/avatar/default.vrm";
  assert.equal(localAvatarUrl("/assets/speaking/avatar/default.vrm", base), base);
  assert.equal(localAvatarUrl("textures/face.png", base), "https://school.example/assets/speaking/avatar/textures/face.png");
  for (const src of ["https://avatar-service.example/model.vrm", "//other.example/model.vrm", "data:application/json,{}", "file:///model.vrm"]) {
    assert.throws(() => localAvatarUrl(src, base), /same-origin local asset/u);
  }
});
