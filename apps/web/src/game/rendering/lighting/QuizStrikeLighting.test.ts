import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createQuizStrikeLightingRig, getQuizStrikeLightingConfig } from "./QuizStrikeLighting";

test("Athletics uses a bright but bounded outdoor lighting profile", () => {
  const config = getQuizStrikeLightingConfig({
    mapId: "athletics_park",
    isFps: false,
    isZombieMode: false,
    isIronJunction: false,
    isTempleRunoff: false,
    quality: "balanced"
  });

  assert.equal(config.background, "#82cbe5");
  assert.equal(config.fog.color, "#c3e6e1");
  assert.ok(config.fog.far > config.fog.near);
  assert.equal(config.shadowQuality, "soft");
  assert.deepEqual(config.sun.direction, [-120, 220, 120]);
});

test("lighting rig owns the key, ambient, and colored fill lights", () => {
  const scene = new THREE.Scene();
  const config = getQuizStrikeLightingConfig({
    mapId: "athletics_park",
    isFps: false,
    isZombieMode: false,
    isIronJunction: false,
    isTempleRunoff: false,
    quality: "high"
  });
  const rig = createQuizStrikeLightingRig(scene, config);

  assert.equal(scene.children.length, 3);
  assert.equal(rig.hemisphere.name, "quizstrike_ambient_fill");
  assert.equal(rig.sun.name, "quizstrike_key_sun");
  assert.equal(rig.fill.name, "quizstrike_colored_fill");
  assert.equal(rig.sun.castShadow, true);
  assert.equal(rig.sun.shadow.mapSize.x, 2048);
});
