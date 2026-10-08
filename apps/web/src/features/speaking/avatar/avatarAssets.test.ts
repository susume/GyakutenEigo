import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { localAvatarUrl } from "./SpeakingAvatarRenderer.js";

test("avatar assets stay on the application origin, with relative local resources supported", () => {
  const base = "https://school.example/assets/speaking/avatar/default.vrm";
  assert.equal(localAvatarUrl("/assets/speaking/avatar/default.vrm", base), base);
  assert.equal(localAvatarUrl("textures/face.png", base), "https://school.example/assets/speaking/avatar/textures/face.png");
  for (const src of ["https://avatar-service.example/model.vrm", "//other.example/model.vrm", "data:application/json,{}", "file:///model.vrm"]) {
    assert.throws(() => localAvatarUrl(src, base), /same-origin local asset/u);
  }
});

test("bundled Mika VRM retains creator metadata, embedded resources and usable facial bindings", () => {
  const directory = new URL("../../../../public/assets/speaking/avatar/", import.meta.url);
  const bytes = readFileSync(new URL("default.vrm", directory));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const model = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  const vrm = model.extensions.VRMC_vrm;
  assert.equal(vrm.specVersion, "1.0");
  assert.equal(vrm.meta.name, "Mika");
  assert.equal(vrm.meta.version, "1.0");
  assert.deepEqual(vrm.meta.authors, ["Peter Hoang"]);
  assert.equal(vrm.meta.licenseUrl, "https://vrm.dev/licenses/1.0/");
  assert.equal(vrm.meta.avatarPermission, "onlyAuthor");
  assert.equal(vrm.meta.commercialUsage, "personalNonProfit");
  assert.equal(vrm.meta.allowRedistribution, false);
  assert.equal(vrm.meta.modification, "prohibited");
  assert.equal(vrm.meta.creditNotation, "required");
  assert.ok(vrm.humanoid.humanBones.head);
  for (const resource of [...model.buffers, ...model.images]) assert.equal(resource.uri, undefined);
  for (const name of ["blink", "aa", "ih", "ou", "ee", "oh"]) {
    const expression = vrm.expressions.preset[name];
    assert.equal(expression.isBinary, false);
    assert.ok(expression.morphTargetBinds.length > 0, `${name} has facial geometry bindings`);
    for (const bind of expression.morphTargetBinds) {
      const mesh = model.meshes[model.nodes[bind.node].mesh];
      assert.ok(mesh.primitives.every((primitive: { targets: unknown[] }) => primitive.targets[bind.index]));
      assert.ok(bind.weight > 0);
    }
  }
  const licence = readFileSync(new URL("LICENSE.md", directory), "utf8");
  assert.ok(licence.includes(createHash("sha256").update(bytes).digest("hex")), "Licence identifies the exact bundled asset");
});
