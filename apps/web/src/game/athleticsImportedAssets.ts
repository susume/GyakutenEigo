import * as THREE from "three";
import { instantiateArenaAsset, loadArenaAsset } from "./arenaAssetLoader";

export type AthleticsImportedAssetSpec = {
  id: string;
  path: string;
  position: [number, number, number];
  scale: number;
  /** Optional authored non-uniform correction for slender structural assets. */
  scaleVector?: [number, number, number];
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
    // The source mesh's lowest vertex is -0.6764 local Y. At scale 52 this
    // places its lowest point at the park floor instead of 34 units in the air.
    position: [-72, 35.2, 28],
    scale: 52,
    rotationY: 0,
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
    position: [-49, 0, -8],
    scale: 6,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-stalls"]
  },
  {
    id: "athletics-drinks-stall",
    path: "/assets/athletics/kenney-stall-drinks.glb",
    position: [24, 0, -55],
    scale: 6,
    rotationY: -Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-stalls"]
  },
  {
    id: "athletics-coaster-straight-a",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    position: [-96, 42, 34],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-curve",
    path: "/assets/athletics/kenney-coaster-steel-curve.glb",
    position: [-80, 46, 42],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-straight-b",
    path: "/assets/athletics/kenney-coaster-steel-straight.glb",
    position: [-64, 42, 36],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-train",
    path: "/assets/athletics/kenney-coaster-train.glb",
    position: [-80, 43.4, 39],
    scale: 4.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-support-a",
    path: "/assets/athletics/kenney-support-large.glb",
    position: [-96, 0, 34],
    scale: 1,
    scaleVector: [4.1, 42, 4.1],
    minimumDetail: 1,
    fallbackObjectNames: ["athletics-fallback-coaster"]
  },
  {
    id: "athletics-coaster-support-b",
    path: "/assets/athletics/kenney-support-large.glb",
    position: [-64, 0, 36],
    scale: 1,
    scaleVector: [4.1, 42, 4.1],
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
      if (asset.scaleVector) instance.scale.set(...asset.scaleVector);
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
