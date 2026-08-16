import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  getStreakAuraTier,
  getStreakAuraTierKey,
  STREAK_AURA_TIERS,
  StreakAura
} from "./StreakAura";

const getShaderColor = (aura: StreakAura, uniformName: string) => {
  let color: THREE.Color | undefined;
  aura.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const material = object.material as THREE.ShaderMaterial;
    const uniform = material.uniforms?.[uniformName]?.value;
    if (uniform instanceof THREE.Color) color = uniform;
  });
  assert.ok(color, `missing shader color uniform ${uniformName}`);
  return color;
};

test("streak aura starts at three tags and maps every requested tier", () => {
  assert.equal(getStreakAuraTierKey(0), null);
  assert.equal(getStreakAuraTierKey(2), null);
  assert.equal(getStreakAuraTierKey(3), "heatingUp");
  assert.equal(getStreakAuraTierKey(4), "dominating");
  assert.equal(getStreakAuraTierKey(5), "wickedSick");
  assert.equal(getStreakAuraTierKey(6), "monster");
  assert.equal(getStreakAuraTierKey(7), "tier7");
  assert.equal(getStreakAuraTierKey(8), "unstoppable");
  assert.equal(getStreakAuraTierKey(9), "godlike");
  assert.equal(getStreakAuraTierKey(10), "maximum");
  assert.equal(getStreakAuraTierKey(15), "maximum");
});

test("ten or more tags use the capped maximum tier", () => {
  const ten = getStreakAuraTier(10);
  const fifteen = getStreakAuraTier(15);
  assert.ok(ten);
  assert.strictEqual(fifteen, ten);
  assert.equal(ten?.minStreak, 10);
  assert.ok((ten?.radius ?? 0) > (getStreakAuraTier(9)?.radius ?? 0));
  assert.ok((ten?.particleCount ?? 0) > (getStreakAuraTier(9)?.particleCount ?? 0));
});

test("tier colors create a readable threat progression without losing the bright core", () => {
  assert.deepEqual(
    STREAK_AURA_TIERS.map((tier) => new THREE.Color(tier.outerColor).getHexString()),
    ["79e7ff", "20cfff", "a86cff", "854dff", "d44cff", "ffd84a", "ffd24a", "ffd43b"]
  );
  assert.deepEqual(
    STREAK_AURA_TIERS.map((tier) => new THREE.Color(tier.innerColor).getHexString()),
    ["ffffff", "ffffff", "ffffff", "ffffff", "ffffff", "ffffff", "fff4c2", "ffffff"]
  );
  assert.equal(new THREE.Color(STREAK_AURA_TIERS.at(-1)?.accentColor).getHexString(), "b85cff");
});

test("aura colors interpolate, keep the core light, and activate the maximum accent", () => {
  const scene = new THREE.Scene();
  const target = new THREE.Group();
  scene.add(target);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  const aura = new StreakAura({ scene, target, seed: "color-player", initialStreak: 7 });

  aura.update(0, 0, camera);
  assert.equal(getShaderColor(aura, "uOuterColor").getHexString(), "d44cff");
  assert.equal(getShaderColor(aura, "uCoreColor").getHexString(), "ffffff");

  aura.setStreak(8);
  aura.update(0.06, 0.06, camera);
  const inFlight = getShaderColor(aura, "uOuterColor");
  assert.notEqual(inFlight.getHexString(), "d44cff");
  assert.notEqual(inFlight.getHexString(), "ffd84a");

  aura.update(1.2, 1.26, camera);
  const settledGold = getShaderColor(aura, "uOuterColor");
  assert.ok(Math.abs(settledGold.r - new THREE.Color("#FFD84A").r) < 0.03);
  assert.ok(Math.abs(settledGold.g - new THREE.Color("#FFD84A").g) < 0.03);
  assert.equal(getShaderColor(aura, "uCoreColor").getHexString(), "ffffff");

  aura.setStreak(10);
  aura.update(1.2, 2.46, camera);
  let accentAmount = 0;
  aura.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const material = object.material as THREE.ShaderMaterial;
    const value = material.uniforms?.uAccentAmount?.value;
    if (typeof value === "number") accentAmount = value;
  });
  assert.ok(accentAmount > 0.1);
  aura.dispose();
});

test("shutdown burst inherits the defeated tier palette", () => {
  const scene = new THREE.Scene();
  const target = new THREE.Group();
  scene.add(target);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  const aura = new StreakAura({ scene, target, initialStreak: 9 });

  aura.update(0.8, 0.8, camera);
  aura.setStreak(0);
  aura.update(0.55, 1.35, camera);
  const burstRing = aura.group.children.at(-1) as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  assert.ok(burstRing.material.color.r > burstRing.material.color.b);
  assert.ok(burstRing.material.color.g > burstRing.material.color.b);
  aura.dispose();
});

test("aura transitions and collapses without changing the streak source", () => {
  const scene = new THREE.Scene();
  const target = new THREE.Group();
  target.scale.setScalar(2.45);
  scene.add(target);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  const aura = new StreakAura({ scene, target, seed: "player-1", initialStreak: 3 });

  aura.update(0, 0, camera);
  assert.deepEqual(aura.getDebugState(), {
    streak: 3,
    tierKey: "heatingUp",
    persistentActive: true,
    shuttingDown: false,
    visible: true
  });

  aura.setStreak(10);
  aura.update(0.18, 0.18, camera);
  assert.equal(aura.getDebugState().tierKey, "maximum");
  assert.equal(aura.getDebugState().shuttingDown, false);

  aura.setStreak(0);
  assert.equal(aura.getDebugState().shuttingDown, true);
  aura.update(0.32, 0.5, camera);
  assert.equal(aura.getDebugState().shuttingDown, true);
  aura.update(0.5, 1, camera);
  assert.deepEqual(aura.getDebugState(), {
    streak: 0,
    tierKey: null,
    persistentActive: false,
    shuttingDown: false,
    visible: false
  });

  aura.dispose();
  assert.equal(scene.children.includes(aura.group), false);
});

test("aura materials keep world-depth occlusion enabled", () => {
  const scene = new THREE.Scene();
  const target = new THREE.Group();
  target.scale.setScalar(2.45);
  scene.add(target);
  const aura = new StreakAura({ scene, target, initialStreak: 8 });
  aura.group.traverse((object) => {
    const material = (object as THREE.Mesh | THREE.Sprite).material;
    if (!material) return;
    assert.equal(material.depthTest, true);
    assert.equal(material.depthWrite, false);
  });
  aura.dispose();
});
