import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type LoadedArenaAsset = THREE.Group;

const loader = new GLTFLoader();
const assetCache = new Map<string, Promise<LoadedArenaAsset>>();
// Reuse browser-side responses for the shared Kenney atlas referenced by
// multiple GLBs. Parsed scene reuse is handled by assetCache below.
THREE.Cache.enabled = true;

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const normalizeMaterials = (scene: THREE.Group) => {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if ("roughness" in standard) standard.roughness = Math.max(0.56, standard.roughness ?? 0.72);
      if ("metalness" in standard) standard.metalness = Math.min(0.68, standard.metalness ?? 0.1);
    });
  });
  scene.updateMatrixWorld(true);
  return scene;
};

/**
 * Loads one GLB per URL for the lifetime of the page. Map scenes receive
 * cheap clones, so changing maps or rounds never downloads the same asset
 * twice. The source scene owns the shared geometry/materials.
 */
export const loadArenaAsset = (path: string) => {
  const cached = assetCache.get(path);
  if (cached) return cached;
  const pending = loader.loadAsync(assetUrl(path)).then((gltf) => normalizeMaterials(gltf.scene));
  assetCache.set(path, pending);
  return pending;
};

export const instantiateArenaAsset = ({
  source,
  name,
  position,
  scale = 1,
  rotationY = 0
}: {
  source: LoadedArenaAsset;
  name: string;
  position: THREE.Vector3;
  scale?: number;
  rotationY?: number;
}) => {
  const instance = source.clone(true);
  instance.name = name;
  instance.position.copy(position);
  instance.rotation.y = rotationY;
  instance.scale.setScalar(scale);
  instance.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Shared GLB resources must survive scene teardown and map switching.
    mesh.userData.preserveSharedResources = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return instance;
};
