import * as THREE from "three";
import { ARENA_SCALE } from "@quizstrike/shared";
import { instantiateArenaAsset, loadArenaAsset, releaseArenaAsset } from "./arenaAssetLoader";

const s = (value: number) => value * ARENA_SCALE;

type ImportedAssetSpec = {
  id: string;
  path: string;
  position: [number, number, number];
  scale: number;
  rotationY?: number;
  minimumDetail: number;
  fallbackBlockIds?: readonly string[];
  fallbackObjectNames?: readonly string[];
};

/** Curated pilot-map subset. Keep this list small and map-specific. */
export const IRON_JUNCTION_IMPORTED_ASSETS: readonly ImportedAssetSpec[] = [
  {
    id: "iron-junction-locomotive",
    path: "/assets/arena/iron-junction/kenney-train-locomotive-a.glb",
    position: [-19, 0, 0],
    scale: 6.5,
    rotationY: Math.PI / 2,
    minimumDetail: 0,
    fallbackBlockIds: ["junction-locomotive"]
  },
  {
    id: "iron-junction-boxcar",
    path: "/assets/arena/iron-junction/kenney-train-carriage-box.glb",
    position: [4, 0, 0],
    scale: 6.5,
    rotationY: Math.PI / 2,
    minimumDetail: 1
  },
  {
    id: "iron-junction-blue-container",
    path: "/assets/arena/iron-junction/kenney-train-carriage-container-blue.glb",
    position: [84, 0, 42],
    scale: 6.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackBlockIds: ["freight-train-east"]
  },
  {
    id: "iron-junction-red-container",
    path: "/assets/arena/iron-junction/kenney-train-carriage-container-red.glb",
    position: [124, 0, 42],
    scale: 6.1,
    rotationY: Math.PI / 2,
    minimumDetail: 1,
    fallbackBlockIds: ["freight-train-east"]
  },
  {
    id: "iron-junction-maintenance-crane",
    path: "/assets/arena/iron-junction/kenney-factory-crane.glb",
    position: [82, 0, 154],
    scale: 5.2,
    rotationY: Math.PI / 2,
    minimumDetail: 0
  },
  {
    id: "iron-junction-control-tower",
    path: "/assets/arena/iron-junction/iron-junction-control-tower.glb",
    position: [58, 0, -38],
    scale: ARENA_SCALE,
    minimumDetail: 0,
    fallbackObjectNames: ["iron_junction_control_landmark"]
  }
];

type SignSpec = {
  id: string;
  label: string;
  sublabel: string;
  position: [number, number, number];
  accent: string;
  rotationY?: number;
  width: number;
};

const SIGN_SPECS: readonly SignSpec[] = [
  {
    id: "junction-control-sign",
    label: "JUNCTION CONTROL",
    sublabel: "CENTRAL RAIL YARD",
    position: [58, 24.5, -54],
    accent: "#f3a44b",
    width: 20
  },
  {
    id: "freight-warehouse-sign",
    label: "FREIGHT WAREHOUSE",
    sublabel: "LOADING DOCK · ZONE A",
    position: [-110, 11.5, -48],
    accent: "#42c8ff",
    width: 21
  },
  {
    id: "maintenance-depot-sign",
    label: "MAINTENANCE DEPOT",
    sublabel: "REPAIR BAY · ZONE B",
    position: [110, 11.5, 90],
    accent: "#f3a44b",
    rotationY: Math.PI,
    width: 21
  },
  {
    id: "dispatch-station-sign",
    label: "DISPATCH STATION",
    sublabel: "RED ROUTE · PLATFORM",
    position: [132, 11.5, -58],
    accent: "#ff6b62",
    width: 20
  }
];

const createSignTexture = (label: string, sublabel: string, accent: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#17272d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 18, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fillRect(18, 18, canvas.width - 36, canvas.height - 36);
  context.strokeStyle = accent;
  context.lineWidth = 8;
  context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "#f6f0df";
  context.font = "800 52px system-ui, sans-serif";
  context.fillText(label, 56, 104, 900);
  context.fillStyle = accent;
  context.font = "700 22px system-ui, sans-serif";
  context.fillText(sublabel, 58, 174, 900);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
};

const addSign = (root: THREE.Group, spec: SignSpec) => {
  const sign = new THREE.Group();
  sign.name = spec.id;
  sign.position.set(s(spec.position[0]), spec.position[1], s(spec.position[2]));
  sign.rotation.y = spec.rotationY ?? 0;

  const height = spec.width * 0.24;
  const width = s(spec.width);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.7, s(height) + 0.7, 0.35),
    new THREE.MeshStandardMaterial({ color: "#26373c", roughness: 0.78, metalness: 0.34 })
  );
  back.position.z = 0.15;
  back.castShadow = true;
  sign.add(back);

  const texture = createSignTexture(spec.label, spec.sublabel, spec.accent);
  if (texture) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width, s(height)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    );
    face.position.z = -0.05;
    sign.add(face);
  }

  for (const x of [-0.42, 0.42]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, s(4.8), 8),
      new THREE.MeshStandardMaterial({ color: "#3d4a4c", roughness: 0.86, metalness: 0.55 })
    );
    post.position.set(width * x, -s(2.3), 0.16);
    post.castShadow = true;
    sign.add(post);
  }
  root.add(sign);
};

const disposeOwnedRootResources = (root: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.preserveSharedResources) return;
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material as THREE.Material & Record<string, unknown>).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

export const mountIronJunctionImportedAssets = async ({
  scene,
  detail,
  isFps,
  signal
}: {
  scene: THREE.Scene;
  detail: number;
  isFps: boolean;
  signal?: AbortSignal;
}) => {
  const root = new THREE.Group();
  root.name = "iron_junction_imported_assets";
  scene.add(root);
  SIGN_SPECS.forEach((spec) => addSign(root, spec));
  let disposed = false;
  const acquiredPaths: string[] = [];
  const isDisposed = () => disposed || signal?.aborted === true;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeOwnedRootResources(root);
    root.removeFromParent();
    acquiredPaths.forEach((path) => releaseArenaAsset(path));
    acquiredPaths.length = 0;
  };
  const onAbort = () => dispose();
  if (signal?.aborted) dispose();
  else signal?.addEventListener("abort", onAbort, { once: true });

  await Promise.all(IRON_JUNCTION_IMPORTED_ASSETS.filter((asset) => detail >= asset.minimumDetail).map(async (asset) => {
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
        scale: asset.scale,
        rotationY: asset.rotationY
      });
      if (isFps) instance.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      root.add(instance);
      asset.fallbackBlockIds?.forEach((blockId) => {
        const fallback = scene.getObjectByName(`modular_${blockId}`);
        if (fallback) fallback.visible = false;
      });
      asset.fallbackObjectNames?.forEach((objectName) => {
        const fallback = scene.getObjectByName(objectName);
        if (fallback) fallback.visible = false;
      });
    } catch (error) {
      if (isDisposed()) return;
      // The procedural map remains playable if an optional GLB fails to load.
      console.warn(`[QuizStrike] optional Iron Junction asset failed: ${asset.id}`, error);
    }
  }));

  return {
    dispose: () => {
      signal?.removeEventListener("abort", onAbort);
      dispose();
    }
  };
};
