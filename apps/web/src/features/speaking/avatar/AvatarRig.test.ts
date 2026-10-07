import assert from "node:assert/strict";
import test from "node:test";
import { Group, Object3D, Vector3 } from "three";
import { VRM, VRMHumanoid, type VRMHumanBones } from "@pixiv/three-vrm";
import { AvatarRig } from "./AvatarRig.js";

function fixture(expressions: string[], hasJaw = false, blockingExpressions = false) {
  const head = new Object3D();
  const chest = new Object3D();
  const jaw = new Object3D();
  const values = new Map<string, number>(expressions.map((name) => [name, 0.8]));
  let updates = 0;
  const vrm = {
    expressionManager: {
      resetValues: () => values.forEach((_, name) => values.set(name, 0)),
      getExpression: (name: string) => values.has(name)
        ? { overrideMouth: blockingExpressions && name === "happy" ? "block" : "none", overrideBlink: blockingExpressions && name === "relaxed" ? "block" : "none" } : null,
      setValue: (name: string, weight: number) => {
        assert.ok(values.has(name), `Unexpected expression: ${name}`);
        values.set(name, weight);
      }
    },
    humanoid: { getNormalizedBoneNode: (name: string) => name === "head" ? head : name === "chest" ? chest : name === "jaw" && hasJaw ? jaw : null },
    lookAt: { autoUpdate: true, yaw: 0, pitch: 0 },
    update: () => { updates += 1; }
  } as unknown as VRM;
  return { vrm, values, jaw, updates: () => updates };
}

test("a model with only aa can speak all procedural vowels and return to neutral", () => {
  const model = fixture(["aa", "blink"]);
  const rig = new AvatarRig(model.vrm);
  assert.deepEqual([...model.values.values()], [0, 0]);
  let mouthSeen = false;
  for (let i = 0; i < 180; i += 1) {
    rig.update(1 / 30, "speaking", false);
    mouthSeen ||= model.values.get("aa")! > 0.15;
  }
  assert.ok(mouthSeen);
  for (let i = 0; i < 12; i += 1) rig.update(1 / 30, "listening", false);
  assert.ok(model.values.get("aa")! < 0.001);
  assert.equal(model.updates(), 192);
});

test("custom mouth-open and separate eye blink expressions are supported", () => {
  const model = fixture(["mouthOpen", "blinkLeft", "blinkRight", "happy", "relaxed"]);
  const rig = new AvatarRig(model.vrm);
  let blinkSeen = false;
  let mouthSeen = false;
  for (let i = 0; i < 300; i += 1) {
    rig.update(1 / 30, "speaking", true);
    blinkSeen ||= model.values.get("blinkLeft")! > 0.5;
    mouthSeen ||= model.values.get("mouthOpen")! > 0.15;
    assert.equal(model.values.get("blinkLeft"), model.values.get("blinkRight"));
  }
  assert.ok(blinkSeen && mouthSeen);
  for (let i = 0; i < 30; i += 1) rig.update(1 / 30, "paused", true);
  assert.ok(model.values.get("mouthOpen")! < 0.001);
  assert.ok(model.values.get("happy")! > 0.04 && model.values.get("happy")! < 0.08, "Paused partners stay gently friendly");
});

test("optional expressions may be absent; a jaw bone is used when available", () => {
  const model = fixture([], true);
  const rig = new AvatarRig(model.vrm);
  let jawSeen = false;
  for (let i = 0; i < 180; i += 1) {
    rig.update(1 / 30, "speaking", false);
    jawSeen ||= Math.abs(model.jaw.rotation.x) > 0.01;
  }
  assert.ok(jawSeen);
  for (let i = 0; i < 12; i += 1) rig.update(1 / 30, "thinking", false);
  assert.ok(Math.abs(model.jaw.rotation.x) < 0.001);
  // A model without expressions or a jaw still has a working portrait.
  const bare = fixture([]);
  Object.defineProperty(bare.vrm, "expressionManager", { value: undefined });
  assert.doesNotThrow(() => new AvatarRig(bare.vrm).update(1 / 30, "idle", false));
});

test("optional facial activity never blocks speech or blinking on models with override expressions", () => {
  const model = fixture(["aa", "blink", "happy", "relaxed"], false, true);
  const rig = new AvatarRig(model.vrm);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "speaking", false);
  assert.equal(model.values.get("happy"), 0);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "thinking", false);
  assert.equal(model.values.get("relaxed"), 0);
});

test("friendly expressions reach the rig in reduced motion without opening a listening mouth", () => {
  const model = fixture(["aa", "blink", "happy", "relaxed"]);
  const rig = new AvatarRig(model.vrm, () => 0.5);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "idle", true);
  const idle = model.values.get("happy")!;
  assert.ok(idle > 0.04 && idle < 0.1);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "listening", true);
  assert.ok(model.values.get("happy")! > idle);
  assert.equal(model.values.get("aa"), 0);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "thinking", true);
  assert.ok(model.values.get("happy")! < idle);
  assert.ok(model.values.get("relaxed")! > 0.03);
  assert.equal(model.values.get("aa"), 0);
});

test("binary or gaze-blocking expressions do not become a permanent grin or frozen stare", () => {
  const model = fixture(["aa", "blink", "happy", "relaxed"]);
  Object.defineProperty(model.vrm.expressionManager, "getExpression", { value: (name: string) => model.values.has(name) ? ({
    isBinary: name === "happy", overrideMouth: "none", overrideBlink: "none",
    overrideLookAt: name === "relaxed" ? "block" : "none"
  }) : null });
  const rig = new AvatarRig(model.vrm, () => 0.5);
  for (let i = 0; i < 90; i += 1) rig.update(1 / 30, "speaking", false);
  assert.equal(model.values.get("happy"), 0);
  assert.equal(model.values.get("relaxed"), 0);
});

test("portrait arms point down for both VRM coordinate orientations", () => {
  for (const orientation of [-1, 1]) {
    const root = new Group();
    const hips = new Object3D();
    const spine = new Object3D();
    const head = new Object3D();
    root.add(hips); hips.add(spine); spine.add(head);
    spine.position.y = 1;
    head.position.y = 0.5;
    const bones = { hips: { node: hips }, spine: { node: spine }, head: { node: head } } as VRMHumanBones;
    for (const [side, sign] of [["left", orientation], ["right", -orientation]] as const) {
      const upper = new Object3D();
      const lower = new Object3D();
      spine.add(upper); upper.add(lower);
      upper.position.set(sign * 0.2, 0.2, 0);
      lower.position.x = sign * 0.3;
      bones[`${side}UpperArm`] = { node: upper };
      bones[`${side}LowerArm`] = { node: lower };
    }
    const humanoid = new VRMHumanoid(bones);
    root.add(humanoid.normalizedHumanBonesRoot);
    const vrm = new VRM({ scene: root, humanoid,
      meta: { metaVersion: "1", name: "Unit test rig", authors: [], licenseUrl: "" } });
    new AvatarRig(vrm).update(0, "idle", false);
    root.updateMatrixWorld(true);
    for (const side of ["left", "right"] as const) {
      const upper = humanoid.getRawBoneNode(`${side}UpperArm`)!.getWorldPosition(new Vector3());
      const lower = humanoid.getRawBoneNode(`${side}LowerArm`)!.getWorldPosition(new Vector3());
      assert.ok(lower.y < upper.y - 0.25, `${side} arm raised in orientation ${orientation}`);
    }
  }
});
