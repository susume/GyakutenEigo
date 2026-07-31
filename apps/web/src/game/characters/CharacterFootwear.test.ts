import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  FOOTWEAR_CATALOG,
  FOOTWEAR_IDS,
  type PlayerFootwearId,
  type PlayerHeadStyleId
} from "@quizstrike/shared";
import { CharacterFactory } from "./CharacterFactory";

const bodyOf = (root: THREE.Object3D) => {
  let body: THREE.SkinnedMesh | undefined;
  root.traverse((object) => {
    if (!body && object instanceof THREE.SkinnedMesh) body = object;
  });
  assert.ok(body);
  return body;
};

const footwearBounds = (body: THREE.SkinnedMesh) => {
  const position = body.geometry.getAttribute("position");
  const skinIndex = body.geometry.getAttribute("skinIndex");
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    count: 0
  };
  for (let index = 0; index < position.count; index += 1) {
    const bone = skinIndex.getX(index);
    const y = position.getY(index);
    if ((bone !== 11 && bone !== 12) || y > 0.34) continue;
    const x = position.getX(index);
    const z = position.getZ(index);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
    bounds.count += 1;
  }
  return bounds;
};

test("the footwear registry contains exactly the six initial cosmetic-only styles", () => {
  assert.deepEqual(FOOTWEAR_IDS, [
    "runners",
    "army_boots",
    "skate_shoes",
    "basketball_shoes",
    "sandals",
    "barefoot"
  ]);
  assert.equal(FOOTWEAR_CATALOG.length, 6);
  assert.equal(FOOTWEAR_CATALOG.every((item) => item.unlockLevel === 1), true);
  assert.equal(FOOTWEAR_CATALOG.find((item) => item.id === "barefoot")?.teamAccent, "none");
});

test("each footwear ID replaces the merged shoe geometry with a distinct grounded silhouette", () => {
  const factory = new CharacterFactory();
  const signatures = new Set<string>();
  for (const footwearId of FOOTWEAR_IDS) {
    const model = factory.createCharacter({
      playerId: `footwear-${footwearId}`,
      team: "blue",
      appearance: {
        headStyleId: "boy_short_hair",
        backAccessoryId: "none",
        footwearId,
        victoryPoseId: "champion",
        appearanceVersion: 7
      }
    });
    const body = bodyOf(model.root);
    assert.equal(body.userData.geometryStats.footwearId, footwearId);
    assert.equal(model.root.getObjectByName("Accessory_shoulder_badge"), undefined);
    const bounds = footwearBounds(body);
    assert.ok(bounds.count > 0);
    assert.ok(bounds.minY >= -0.035 && bounds.minY <= 0.005, `${footwearId} misses the shared ground plane`);
    signatures.add([
      bounds.count,
      (bounds.maxX - bounds.minX).toFixed(3),
      (bounds.maxY - bounds.minY).toFixed(3),
      (bounds.maxZ - bounds.minZ).toFixed(3)
    ].join(":"));
    model.dispose();
  }
  assert.equal(signatures.size, FOOTWEAR_IDS.length);
  factory.dispose();
});

test("Red and Blue use identical footwear geometry with palette-driven accents", () => {
  const factory = new CharacterFactory();
  for (const footwearId of FOOTWEAR_IDS) {
    const make = (team: "blue" | "red") => factory.createCharacter({
      playerId: `${team}-${footwearId}`,
      team,
      appearance: {
        headStyleId: "robot",
        backAccessoryId: "none",
        footwearId,
        victoryPoseId: "champion",
        appearanceVersion: 7
      }
    });
    const blue = make("blue");
    const red = make("red");
    const blueBody = bodyOf(blue.root);
    const redBody = bodyOf(red.root);
    const bluePositions = blueBody.geometry.getAttribute("position");
    const redPositions = redBody.geometry.getAttribute("position");
    assert.equal(bluePositions.count, redPositions.count);
    for (let index = 0; index < bluePositions.count; index += 1) {
      assert.equal(bluePositions.getX(index), redPositions.getX(index));
      assert.equal(bluePositions.getY(index), redPositions.getY(index));
      assert.equal(bluePositions.getZ(index), redPositions.getZ(index));
    }
    assert.notEqual(
      blueBody.geometry.getAttribute("color").getX(0),
      redBody.geometry.getAttribute("color").getX(0)
    );
    blue.dispose();
    red.dispose();
  }
  factory.dispose();
});

test("mandatory head, footwear, team, and animation combinations remain attached", () => {
  const combinations: Array<[PlayerHeadStyleId, PlayerFootwearId]> = [
    ["boy_short_hair", "runners"],
    ["fox", "army_boots"],
    ["panda", "skate_shoes"],
    ["samurai", "basketball_shoes"],
    ["ninja", "sandals"],
    ["great_white", "barefoot"],
    ["robot", "army_boots"],
    ["girl_mid_hair", "runners"],
    ["boy_short_hair", "skate_shoes"]
  ];
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2.5, 10);
  const factory = new CharacterFactory();

  for (const team of ["blue", "red"] as const) {
    for (const [headStyleId, footwearId] of combinations) {
      const model = factory.createCharacter({
        playerId: `${team}-${headStyleId}-${footwearId}`,
        team,
        appearance: {
          headStyleId,
          backAccessoryId: "none",
          footwearId,
          victoryPoseId: "champion",
          appearanceVersion: 7
        }
      });
      const body = bodyOf(model.root);
      const states = [
        { speed: 0, forwardSpeed: 0 },
        { speed: 3.2, forwardSpeed: 3.2 },
        { speed: 5.4, forwardSpeed: 5.4 },
        { speed: 0, forwardSpeed: 0, crouching: true },
        { speed: 0, forwardSpeed: 0, aimPitch: -0.18 },
        { speed: 0, forwardSpeed: 0, firing: true }
      ];
      states.forEach((state, index) => model.update({
        camera,
        delta: 1 / 60,
        elapsed: index / 60,
        alive: true,
        ...state
      }));
      for (const cue of ["jump", "fire", "respawn", "victory"] as const) {
        model.triggerAnimation(cue);
        model.update({ camera, delta: 1 / 60, elapsed: 1, speed: 0, alive: true });
      }
      assert.equal(body.skeleton.bones.length, 13);
      assert.equal(body.userData.geometryStats.footwearId, footwearId);
      assert.equal(model.appearance.silhouette.heightScale, 1);
      model.dispose();
    }
  }
  factory.dispose();
});
