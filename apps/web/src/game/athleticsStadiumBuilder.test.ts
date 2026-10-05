import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATHLETICS_PLAYER_EYE_HEIGHT, ATHLETICS_STADIUM_COURSE, getAthleticsMovingObstaclePosition } from "@quizstrike/shared";
import { buildAthleticsStadiumScene } from "./athleticsStadiumBuilder";

test("floating pink decks, collision boxes, and passive rider carry share the same moving height", (context) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  // Drawing is irrelevant to this transform test; real rendering is checked in the course preview.
  const drawing = new Proxy({}, { get: () => () => {} });
  const canvas = () => ({ width: 512, height: 512, getContext: () => drawing }) as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: canvas } });
  let nowMs = 1000;
  context.mock.method(Date, "now", () => nowMs);
  try {
    const scene = new THREE.Scene();
    const built = buildAthleticsStadiumScene({ scene,
      renderer: { domElement: { dataset: {} } } as unknown as THREE.WebGLRenderer,
      isFps: true, activeQuality: "performance",
      qualityConfig: { pixelRatio: 1, anisotropy: 2, detail: 0, shadows: false },
      makeCanvasTexture: () => new THREE.CanvasTexture(canvas()), seededRandom: () => () => .5 });
    const floats = ATHLETICS_STADIUM_COURSE.surfaces.filter((surface) => surface.movingObstacleId);
    assert.equal(floats.length, 10);
    for (const surface of floats) {
      const mover = ATHLETICS_STADIUM_COURSE.movingObstacles.find((entry) => entry.id === surface.movingObstacleId)!;
      const group = scene.getObjectByName(`moving-${mover.id}`)!;
      assert.ok(group);
      assert.equal(scene.getObjectByName(`athletics-platform-edge-${surface.id}`), undefined,
        "the static landing must not remain under its floating replacement");
      built.athleticsUpdate(0);
      const before = getAthleticsMovingObstaclePosition(mover, nowMs);
      const rider = new THREE.Vector3(before.x, before.y + mover.height + ATHLETICS_PLAYER_EYE_HEIGHT, before.z);
      nowMs += 40;
      const carry = built.athleticsUpdate(0, rider, true);
      const after = getAthleticsMovingObstaclePosition(mover, nowMs);
      assert.ok(Math.abs(carry.y - (after.y - before.y)) < 1e-9, mover.id);
      assert.equal(carry.x, 0);
      assert.equal(carry.z, 0);
      assert.equal(group.position.y, after.y);
      const box = built.coverBoxes.find((entry) => Math.abs(entry.getCenter(new THREE.Vector3()).x - after.x) < .001
        && Math.abs(entry.getCenter(new THREE.Vector3()).z - after.z) < .001)!;
      assert.ok(box);
      assert.equal(box.max.y, after.y + mover.height);
      nowMs += 40;
      assert.deepEqual(built.athleticsUpdate(0, rider, false), { x: 0, y: 0, z: 0 }, "jumping must detach the rider from carry");
    }
    built.staticBatcher.dispose();
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
