import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";
import { instantiateArenaAsset, loadArenaAsset, releaseArenaAsset } from "./arenaAssetLoader";

const s = (value: number) => value * ARENA_SCALE;
// The classroom character rig is intentionally larger than a real-world
// human (5.02 world units tall). Match sourced props to that authored scale
// so a real car, lamp, or stall does not read as a miniature beside players.
export const DESERT_CITADEL_PROP_SCALE = 3.25;
export const DESERT_CITADEL_STALL_SCALE = 4;

const lowerBazaarCounter = (instance: THREE.Object3D) => {
  instance.traverse((object) => {
    if (object.name === "market_counter_top") {
      object.position.y = 0.84;
      return;
    }
    if (object.name === "market_counter_front") {
      object.position.y = 0.42;
      object.scale.y *= 0.70 / 0.88;
      return;
    }
    if (object.name.startsWith("market_counter_leg")) {
      object.position.y = 0.40;
      object.scale.y *= 0.74 / 0.90;
    }
  });
};

type ImportedAssetSpec = {
  id: string;
  path: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  fallbackBlockIds?: readonly string[];
};

export const DESERT_CITADEL_IMPORTED_ASSETS: readonly ImportedAssetSpec[] = [
  {
    id: "desert-citadel-service-car",
    path: "/assets/arena/desert-citadel/props/covered-service-car.glb",
    position: [-115, 0, 150],
    rotationY: Math.PI / 2,
    scale: DESERT_CITADEL_PROP_SCALE,
    fallbackBlockIds: ["cistern-service-car"]
  },
  ...[
    [-20, -88],
    [20, -88],
    [-180, 150],
    [180, 150]
  ].map(([x, z], index) => ({
    id: `desert-citadel-street-lamp-${index + 1}`,
    path: "/assets/arena/desert-citadel/props/street-lamp.glb",
    position: [x, 0, z] as [number, number, number],
    scale: DESERT_CITADEL_PROP_SCALE,
    rotationY: index % 2 ? Math.PI : 0
  })),
  ...[
    ["souk-stall-west-outer", -140],
    ["souk-stall-west-inner", -84],
    ["souk-stall-center-west", -28],
    ["souk-stall-center-east", 28],
    ["souk-stall-east-inner", 84],
    ["souk-stall-east-outer", 140]
  ].map(([blockId, x], index) => ({
    id: `desert-citadel-bazaar-stall-${index + 1}`,
    path: "/assets/arena/desert-citadel/props/bazaar-stall.glb",
    // One level row: identical scale, identical facing, and every back edge
    // sits against the south face of the Crown Rampart wall at z=-144.
    position: [Number(x), 0, -131] as [number, number, number],
    scale: DESERT_CITADEL_STALL_SCALE,
    rotationY: 0,
    fallbackBlockIds: [String(blockId)]
  }))
];

const hideFallbackBlock = (scene: THREE.Scene, blockId: string) => {
  for (const name of [`modular_${blockId}`, `detail_${blockId}`]) {
    const fallback = scene.getObjectByName(name);
    if (fallback) fallback.visible = false;
  }
};

const showLoadFailureFallback = (scene: THREE.Scene, blockId: string) => {
  const proxy = scene.getObjectByName(`collision_proxy_${blockId}`) as THREE.Mesh | undefined;
  if (!proxy?.isMesh) return;
  proxy.material = new THREE.MeshStandardMaterial({
    color: blockId.includes("stall") ? "#9a6846" : "#8c653f",
    roughness: 0.82,
    metalness: blockId.includes("car") ? 0.24 : 0.02
  });
  proxy.visible = true;
};

export const mountDesertCitadelImportedAssets = async ({
  scene,
  isFps,
  signal
}: {
  scene: THREE.Scene;
  isFps: boolean;
  signal?: AbortSignal;
}) => {
  const root = new THREE.Group();
  root.name = "desert_citadel_imported_assets";
  scene.add(root);
  let disposed = false;
  const acquiredPaths: string[] = [];
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

  await Promise.all(DESERT_CITADEL_IMPORTED_ASSETS.map(async (asset) => {
    if (isDisposed()) return;
    try {
      const source = await loadArenaAsset(asset.path);
      acquiredPaths.push(asset.path);
      if (isDisposed()) {
        releaseArenaAsset(asset.path);
        return;
      }
      const instance = instantiateArenaAsset({
        source,
        name: asset.id,
        position: new THREE.Vector3(s(asset.position[0]), asset.position[1], s(asset.position[2])),
        scale: asset.scale ?? 1,
        rotationY: asset.rotationY
      });
      if (asset.path.endsWith("bazaar-stall.glb")) lowerBazaarCounter(instance);
      if (isFps) instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      root.add(instance);
      asset.fallbackBlockIds?.forEach((blockId) => hideFallbackBlock(scene, blockId));
    } catch (error) {
      if (isDisposed()) return;
      // Collision-aware procedural fallbacks stay visible if an optional GLB
      // cannot load, so the map remains readable and multiplayer-safe.
      asset.fallbackBlockIds?.forEach((blockId) => showLoadFailureFallback(scene, blockId));
      console.warn(`[QuizStrike] optional Desert Citadel asset failed: ${asset.id}`, error);
    }
  }));

  return {
    dispose: () => {
      signal?.removeEventListener("abort", onAbort);
      dispose();
    }
  };
};
