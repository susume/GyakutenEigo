import * as THREE from "three";
import { instantiateArenaAsset, loadArenaAsset } from "./arenaAssetLoader";

export type AthleticsImportedAssetSpec = {
  id: string;
  path: string;
  position: [number, number, number];
  scale: number;
  rotationY?: number;
  minimumDetail: number;
  fallbackObjectNames?: readonly string[];
};

/**
 * Small, optional Athletics asset set. The authored boxes remain the source
 * of truth for movement; these GLBs are scenery only and can fail without
 * taking the race down.
 */
export const ATHLETICS_IMPORTED_ASSETS: readonly AthleticsImportedAssetSpec[] = [
  {
    id: "athletics-ferris-wheel",
    path: "/assets/athletics/creative-trio-ferris-wheel.glb",
    position: [-78, 69, 43],
    scale: 52,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-ferris-wheel"]
  },
  {
    id: "athletics-park-entrance",
    path: "/assets/athletics/kenney-park-entrance.glb",
    position: [0, 0, 132],
    scale: 4.6,
    rotationY: Math.PI,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-entrance"]
  },
  {
    id: "athletics-food-stall",
    path: "/assets/athletics/kenney-stall-food.glb",
    position: [-26, 22, -47],
    scale: 6,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-stalls"]
  },
  {
    id: "athletics-drinks-stall",
    path: "/assets/athletics/kenney-stall-drinks.glb",
    position: [30, 27, -55],
    scale: 6,
    rotationY: -Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-stalls"]
  },
  {
    id: "athletics-coaster-straight-a",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    position: [-92, 82, 40],
    scale: 4.1,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-curve",
    path: "/assets/athletics/kenney-coaster-steel-curve.glb",
    position: [-75, 84, 40],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-straight-b",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    position: [-58, 86, 34],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-train",
    path: "/assets/athletics/kenney-coaster-train.glb",
    position: [-62, 87.5, 35],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-support-a",
    path: "/assets/athletics/kenney-support-large.glb",
    position: [-92, 77.2, 40],
    scale: 4.1,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-support-b",
    path: "/assets/athletics/kenney-support-large.glb",
    position: [-58, 81.2, 34],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  }
];

export const hideAthleticsImportedAssetFallback = (
  scene: THREE.Object3D,
  asset: Pick<AthleticsImportedAssetSpec, "fallbackObjectNames">
) => {
  asset.fallbackObjectNames?.forEach((objectName) => {
    const fallback = scene.getObjectByName(objectName);
    if (fallback) fallback.visible = false;
  });
};

export const mountAthleticsImportedAssets = async ({
  scene,
  detail,
  isFps
}: {
  scene: THREE.Scene;
  detail: number;
  isFps: boolean;
}) => {
  const root = new THREE.Group();
  root.name = "athletics_imported_assets";
  scene.add(root);
  let disposed = false;

  await Promise.all(ATHLETICS_IMPORTED_ASSETS.filter((asset) => detail >= asset.minimumDetail).map(async (asset) => {
    try {
      const source = await loadArenaAsset(asset.path);
      if (disposed) return;
      const instance = instantiateArenaAsset({
        source,
        name: asset.id,
        position: new THREE.Vector3(...asset.position),
        scale: asset.scale,
        rotationY: asset.rotationY
      });
      if (isFps) instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      root.add(instance);
      hideAthleticsImportedAssetFallback(scene, asset);
    } catch (error) {
      // The procedural fallback remains visible and the course remains playable.
      console.warn(`[QuizStrike] optional Athletics asset failed: ${asset.id}`, error);
    }
  }));

  return {
    dispose: () => {
      disposed = true;
      root.traverse((object) => {
        const dispose = object.userData?.dispose;
        if (typeof dispose === "function") dispose();
      });
      root.removeFromParent();
    }
  };
};
