import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";
import { instantiateArenaAsset, loadArenaAsset } from "./arenaAssetLoader";

const s = (value: number) => value * ARENA_SCALE;

// Blender outputs these shells directly in QuizStrike world units. A 5.02u
// classroom character is therefore roughly one third of a 15u gatehouse,
// matching the authored collision and avoiding dozens of per-instance scales.
export const TEMPLE_RUNOFF_ARCHITECTURE_SCALE = 1;

export type TempleRunoffImportedAssetSpec = {
  id: string;
  path: string;
  position: [number, number, number];
  rotationY?: number;
  scale: number;
  visibleMeshNames?: readonly string[];
  fallbackBlockIds?: readonly string[];
  fallbackCylinderIds?: readonly string[];
};

export const TEMPLE_RUNOFF_IMPORTED_ASSETS: readonly TempleRunoffImportedAssetSpec[] = [
  {
    id: "temple-runoff-rain-god-shrine",
    path: "/assets/arena/temple-runoff/architecture/rain-god-shrine.glb",
    position: [0, 8, 126],
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    fallbackCylinderIds: ["rain-god-statue"]
  },
  {
    id: "temple-runoff-sun-bridge",
    path: "/assets/arena/temple-runoff/architecture/sun-bridge-shell.glb",
    position: [0, 0, 0],
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    // The original bridge shell bundled large altar/support experiments that
    // obscured the lane. Keep its authored GLB deck and use the map's clean,
    // collision-matched pillars and rails for everything above/below it.
    visibleMeshNames: ["temple_temple_sun_stone"],
    fallbackBlockIds: ["sun-bridge-deck"]
  },
  {
    id: "temple-runoff-blue-gatehouse",
    path: "/assets/arena/temple-runoff/architecture/temple-gatehouse.glb",
    position: [-204, 8, -92],
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    fallbackBlockIds: ["blue-temple-gatehouse"]
  },
  {
    id: "temple-runoff-red-gatehouse",
    path: "/assets/arena/temple-runoff/architecture/temple-gatehouse.glb",
    position: [204, 8, 92],
    rotationY: Math.PI,
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    fallbackBlockIds: ["red-temple-gatehouse"]
  },
  {
    id: "temple-runoff-west-sluice",
    path: "/assets/arena/temple-runoff/architecture/sluice-headwall.glb",
    position: [-190, 0, 0],
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    fallbackBlockIds: ["west-sluice-mouth"]
  },
  {
    id: "temple-runoff-east-sluice",
    path: "/assets/arena/temple-runoff/architecture/sluice-headwall.glb",
    position: [190, 0, 0],
    rotationY: Math.PI,
    scale: TEMPLE_RUNOFF_ARCHITECTURE_SCALE,
    fallbackBlockIds: ["east-sluice-mouth"]
  }
];

const fallbackVisualNames = (asset: TempleRunoffImportedAssetSpec) => [
  ...(asset.fallbackBlockIds ?? []).flatMap((id) => [`modular_${id}`, `detail_${id}`]),
  ...(asset.fallbackCylinderIds ?? []).map((id) => `cylinder_visual_${id}`)
];

const fallbackProxyNames = (asset: TempleRunoffImportedAssetSpec) => [
  ...(asset.fallbackBlockIds ?? []).map((id) => `collision_proxy_${id}`),
  ...(asset.fallbackCylinderIds ?? []).map((id) => `collision_proxy_${id}`)
];

export const hideTempleRunoffFallback = (scene: THREE.Scene, asset: TempleRunoffImportedAssetSpec) => {
  fallbackVisualNames(asset).forEach((name) => {
    const fallback = scene.getObjectByName(name);
    if (fallback) fallback.visible = false;
  });
};

export const showTempleRunoffLoadFailureFallback = (scene: THREE.Scene, asset: TempleRunoffImportedAssetSpec) => {
  fallbackVisualNames(asset).forEach((name) => {
    const fallback = scene.getObjectByName(name);
    if (fallback) fallback.visible = true;
  });
  fallbackProxyNames(asset).forEach((name) => {
    const proxy = scene.getObjectByName(name) as THREE.Mesh | undefined;
    if (!proxy?.isMesh) return;
    proxy.material = new THREE.MeshStandardMaterial({
      color: name.includes("sluice") ? "#354b43" : name.includes("bridge") ? "#806d49" : "#596348",
      roughness: 0.9,
      metalness: 0.02
    });
    proxy.visible = true;
  });
};

export const mountTempleRunoffImportedAssets = async ({
  scene,
  isFps
}: {
  scene: THREE.Scene;
  isFps: boolean;
}) => {
  const root = new THREE.Group();
  root.name = "temple_runoff_imported_assets";
  scene.add(root);
  let disposed = false;

  await Promise.all(TEMPLE_RUNOFF_IMPORTED_ASSETS.map(async (asset) => {
    try {
      const source = await loadArenaAsset(asset.path);
      if (disposed) return;
      const instance = instantiateArenaAsset({
        source,
        name: asset.id,
        position: new THREE.Vector3(s(asset.position[0]), asset.position[1], s(asset.position[2])),
        scale: asset.scale,
        rotationY: asset.rotationY
      });
      if (isFps) instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      if (asset.visibleMeshNames) {
        const visibleNames = new Set(asset.visibleMeshNames);
        instance.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh && !visibleNames.has(mesh.name)) mesh.visible = false;
        });
      }
      root.add(instance);
      hideTempleRunoffFallback(scene, asset);
    } catch (error) {
      showTempleRunoffLoadFailureFallback(scene, asset);
      console.warn(`[QuizStrike] critical Temple Runoff asset failed: ${asset.id}`, error);
    }
  }));

  return {
    dispose: () => {
      disposed = true;
      root.removeFromParent();
    }
  };
};
