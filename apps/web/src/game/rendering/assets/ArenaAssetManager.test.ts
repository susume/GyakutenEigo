import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ArenaAssetManager } from "./ArenaAssetManager";

const makeTestManager = () => {
  const manager = new ArenaAssetManager();
  const internals = manager as unknown as {
    loader: {
      loadAsync: (url: string, onProgress?: unknown) => Promise<{ scene: THREE.Group }>;
    };
  };
  internals.loader.loadAsync = async () => ({ scene: new THREE.Group() });
  return manager;
};

test("asset-pack release only releases the selected detail and is idempotent", async () => {
  const manager = makeTestManager();
  const low = { id: "low", path: "/low.glb", minimumDetail: 0 };
  const high = { id: "high", path: "/high.glb", minimumDetail: 1 };
  manager.registerPack({ id: "test-pack", assets: [low, high] });

  await manager.loadAsset(high);
  const loaded = await manager.loadAssetPack("test-pack", 0);
  assert.deepEqual([...loaded.assets.keys()], ["low"]);
  loaded.release();
  loaded.release();

  // The high-detail asset is still held by the independent caller.
  assert.equal(manager.unloadUnusedAssets(), 1);
  manager.releaseAsset(high);
  assert.equal(manager.unloadUnusedAssets(), 1);
  manager.dispose();
});
