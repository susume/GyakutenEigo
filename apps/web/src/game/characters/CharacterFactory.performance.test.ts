import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CharacterFactory } from "./CharacterFactory.js";

test("40 lobby characters keep the shared-body render budget bounded", () => {
  const factory = new CharacterFactory();
  const startedAt = performance.now();
  const models = Array.from({ length: 40 }, (_, index) => factory.createCharacter({
    playerId: `load-student-${index}`,
    team: index % 2 === 0 ? "blue" : "red",
    appearance: {
      characterPreset: "captain",
      headStyleId: index % 2 === 0 ? "fox" : "panda",
      backAccessoryId: "utility_pack",
      detailAccessoryId: "none",
      victoryPoseId: "champion",
      appearanceVersion: 4
    }
  }));
  const constructionMs = performance.now() - startedAt;
  const bodies = models.map((model) => {
    let body: THREE.SkinnedMesh | undefined;
    model.root.traverse((object) => {
      if (!body && object instanceof THREE.SkinnedMesh) body = object;
    });
    assert.ok(body);
    return body;
  });
  const uniqueGeometries = new Set(bodies.map((body) => body.geometry));
  const uniqueMaterials = new Set(bodies.map((body) => body.material));

  assert.equal(bodies.length, 40);
  assert.equal(uniqueGeometries.size, 2);
  assert.equal(uniqueMaterials.size, 2);
  assert.equal(bodies[0].skeleton.bones.length, 13);
  assert.ok(constructionMs < 2_000);

  console.log(JSON.stringify({
    characters: bodies.length,
    constructionMs: Math.round(constructionMs),
    sharedBodyGeometries: uniqueGeometries.size,
    sharedBodyMaterials: uniqueMaterials.size,
    bodyTrianglesEach: bodies[0].geometry.getAttribute("position").count / 3
  }));

  models.forEach((model) => model.dispose());
  factory.dispose();
});
