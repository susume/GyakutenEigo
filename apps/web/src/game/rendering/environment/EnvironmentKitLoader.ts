import * as THREE from "three";
import { loadArenaAsset, releaseArenaAsset, instantiateArenaAsset, registerArenaAssetPack } from "../../arenaAssetLoader";
import { getEnvironmentKitAssets, type EnvironmentKit } from "./EnvironmentKit";

export const hideEnvironmentFallbacks = (scene: THREE.Object3D, fallbackObjectNames?: readonly string[]) => {
  fallbackObjectNames?.forEach((objectName) => {
    const fallback = scene.getObjectByName(objectName);
    if (fallback) fallback.visible = false;
  });
};

/**
 * Mounts one data-driven kit without coupling a map builder to GLTFLoader.
 * Every reference acquired during the mount is released when the root is
 * removed; cached source scenes remain available for a later map switch.
 */
export const mountEnvironmentKit = async ({
  scene,
  kit,
  detail,
  isFps,
  onError,
  signal
}: {
  scene: THREE.Scene;
  kit: EnvironmentKit;
  detail: number;
  isFps: boolean;
  onError?: (assetId: string, error: unknown) => void;
  signal?: AbortSignal;
}) => {
  registerArenaAssetPack({ id: kit.id, assets: getEnvironmentKitAssets(kit) });
  const root = new THREE.Group();
  root.name = `${kit.id}-imported-assets`;
  scene.add(root);
  let disposed = false;
  const acquiredPaths: string[] = [];
  const loadedAssetIds: string[] = [];
  const failedAssetIds: string[] = [];
  const isDisposed = () => disposed || signal?.aborted === true;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    acquiredPaths.forEach((path) => releaseArenaAsset(path));
    acquiredPaths.length = 0;
  };
  const onAbort = () => dispose();
  if (signal?.aborted) dispose();
  else signal?.addEventListener("abort", onAbort, { once: true });

  await Promise.all(getEnvironmentKitAssets(kit, detail).map(async (asset) => {
    if (isDisposed()) return;
    try {
      const source = await loadArenaAsset(asset);
      acquiredPaths.push(asset.path);
      if (isDisposed()) {
        releaseArenaAsset(asset);
        return;
      }
      const instance = instantiateArenaAsset({
        source,
        name: asset.id,
        position: new THREE.Vector3(...asset.position),
        scale: asset.scale,
        scaleVector: asset.scaleVector,
        rotationY: asset.rotationY
      });
      if (isFps) instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      root.add(instance);
      hideEnvironmentFallbacks(scene, asset.fallbackObjectNames);
      loadedAssetIds.push(asset.id);
    } catch (error) {
      if (isDisposed()) return;
      failedAssetIds.push(asset.id);
      onError?.(asset.id, error);
      console.warn(`[QuizStrike] optional ${kit.title} asset failed: ${asset.id}`, error);
    }
  }));

  return {
    root,
    loadedAssetIds,
    failedAssetIds,
    dispose: () => {
      signal?.removeEventListener("abort", onAbort);
      dispose();
    }
  };
};
