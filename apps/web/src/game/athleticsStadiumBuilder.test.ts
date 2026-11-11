import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATHLETICS_PLAYER_EYE_HEIGHT, getAthleticsCourseForMode, getAthleticsMovingObstaclePosition } from "@quizstrike/shared";
import { buildAthleticsStadiumScene } from "./athleticsStadiumBuilder";

test("Zeus landings and floating decks use the course dimensions and preserve passive rider carry", (context) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  // Drawing is irrelevant to this transform test; real rendering is checked in the course preview.
  const drawing = new Proxy({}, { get: () => () => {} });
  const canvas = () => ({ width: 512, height: 512, getContext: () => drawing }) as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: canvas } });
  let nowMs = 1000;
  context.mock.method(Date, "now", () => nowMs);
  try {
    const scene = new THREE.Scene();
    const course = getAthleticsCourseForMode("zeus");
    const built = buildAthleticsStadiumScene({ scene, course,
      renderer: { domElement: { dataset: {} } } as unknown as THREE.WebGLRenderer,
      isFps: true, activeQuality: "performance",
      qualityConfig: { pixelRatio: 1, anisotropy: 2, detail: 0, shadows: false },
      makeCanvasTexture: () => new THREE.CanvasTexture(canvas()), seededRandom: () => () => .5 });
    const summitApproach = course.surfaces[62]!;
    const summitEdge = scene.getObjectByName(`athletics-platform-edge-${summitApproach.id}`);
    assert.ok(summitEdge instanceof THREE.LineSegments);
    summitEdge.geometry.computeBoundingBox();
    assert.ok(Math.abs(summitEdge.geometry.boundingBox!.getSize(new THREE.Vector3()).z - (summitApproach.depth + 0.35)) < 0.001);
    const summitBox = built.coverBoxes.find((box) => box.getCenter(new THREE.Vector3()).z === summitApproach.z && box.max.y === summitApproach.y);
    assert.ok(summitBox);
    assert.ok(Math.abs(summitBox.getSize(new THREE.Vector3()).z - summitApproach.depth) < 0.001);

    const floats = course.surfaces.filter((surface) => surface.movingObstacleId);
    assert.equal(floats.length, 10);
    for (const surface of floats) {
      const mover = course.movingObstacles.find((entry) => entry.id === surface.movingObstacleId)!;
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
      assert.equal(box.getSize(new THREE.Vector3()).z, surface.depth);
      nowMs += 40;
      assert.deepEqual(built.athleticsUpdate(0, rider, false), { x: 0, y: 0, z: 0 }, "jumping must detach the rider from carry");
    }
    built.staticBatcher.dispose();
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
