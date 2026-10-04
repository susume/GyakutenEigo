import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ArenaStaticBatcher, makeSurfaceAtlas } from "./ArenaStaticBatch";

test("replaceable fallback batches retain their visibility owner and world transform", () => {
  const scene = new THREE.Scene();
  const fallback = new THREE.Group();
  fallback.name = "modular_train";
  fallback.userData.staticBatchBoundary = true;
  fallback.position.set(12, 8, -14);
  fallback.rotation.y = .3;
  scene.add(fallback);
  const batcher = new ArenaStaticBatcher(new THREE.Texture(), false);
  const mesh = batcher.prepare(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2)), "#ffffff", "metal");
  mesh.position.set(-1, 1, 0);
  fallback.add(mesh);
  scene.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(mesh);
  const cylinder = batcher.prepare(new THREE.Mesh(new THREE.CylinderGeometry()), "#ffffff", "stone");
  cylinder.name = "cylinder_visual_shrine";
  cylinder.userData.staticBatchBoundary = true;
  scene.add(cylinder);
  batcher.flush(scene);
  assert.equal(scene.getObjectByName(cylinder.name), cylinder, "single-mesh fallback names must also survive batching");
  assert.equal(fallback.children.length, 1);
  const batch = fallback.children[0] as THREE.Mesh;
  assert.equal(batch.parent, fallback, "loading a GLB must still be able to hide its fallback");
  const after = new THREE.Box3().setFromObject(batch);
  assert.ok(before.min.distanceTo(after.min) < .0001);
  assert.ok(before.max.distanceTo(after.max) < .0001);
  fallback.visible = false;
  assert.equal(batch.parent.visible, false);
  batch.geometry.dispose();
  batcher.dispose();
});

test("atlas upload preserves the authored surface quadrants used by mesh UVs", () => {
  const draws: unknown[][] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args: unknown[]) => draws.push(args) }) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  try {
    const textures = Object.fromEntries(["stone", "wood", "metal", "sand"].map(key => [key, new THREE.Texture({ kind: key })])) as Record<"stone" | "wood" | "metal" | "sand", THREE.Texture>;
    const atlas = makeSurfaceAtlas(textures);
    assert.equal(atlas.flipY, false, "GPU upload must not exchange stone/metal or wood/sand");
    assert.deepEqual(draws.map(draw => draw.slice(0, 3)), [
      [textures.metal.image, 0, 0], [textures.sand.image, 512, 0],
      [textures.stone.image, 0, 512], [textures.wood.image, 512, 512]
    ]);
    const batch = new ArenaStaticBatcher(atlas, false);
    for (const [surface, tileX, tileY] of [["metal", 0, 0], ["sand", 1, 0], ["stone", 0, 1], ["wood", 1, 1]] as const) {
      const mesh = batch.prepare(new THREE.Mesh(new THREE.BoxGeometry()), "#ffffff", surface);
      const uv = mesh.geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) {
        assert.ok(uv.getX(i) >= tileX * .5 && uv.getX(i) < (tileX + 1) * .5);
        assert.ok(uv.getY(i) >= tileY * .5 && uv.getY(i) < (tileY + 1) * .5);
      }
      mesh.geometry.dispose();
    }
    batch.dispose();
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
