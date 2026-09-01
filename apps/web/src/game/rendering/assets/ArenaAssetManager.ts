import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export type ArenaAssetDefinition = {
  id: string;
  path: string;
  minimumDetail?: number;
  preload?: boolean;
};

export type ArenaAssetPack = {
  id: string;
  assets: readonly ArenaAssetDefinition[];
};

export type ArenaAssetPackLoad = {
  pack: ArenaAssetPack;
  assets: Map<string, THREE.Group>;
  failed: number;
  release: () => void;
};

export type ArenaAssetProgress = {
  loaded: number;
  total: number;
  failed: number;
  active: number;
};

type AssetRecord = {
  path: string;
  promise: Promise<THREE.Group>;
  source?: THREE.Group;
  error?: unknown;
  references: number;
};

type AssetProgressListener = (progress: ArenaAssetProgress) => void;

const toUrl = (path: string) => `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\/+/, "")}`;

const disposeOwnedScene = (scene: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      const materialWithTextures = material as THREE.Material & Record<string, unknown>;
      Object.values(materialWithTextures).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

const normalizeScene = (scene: THREE.Group) => {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if ("roughness" in standard) standard.roughness = THREE.MathUtils.clamp(standard.roughness ?? 0.72, 0.56, 0.94);
      if ("metalness" in standard) standard.metalness = THREE.MathUtils.clamp(standard.metalness ?? 0.08, 0, 0.68);
      if ("envMapIntensity" in standard) standard.envMapIntensity = Math.min(1.2, standard.envMapIntensity ?? 1);
    });
  });
  scene.updateMatrixWorld(true);
  return scene;
};

/**
 * Small, page-scoped GLB manager shared by every arena. A path is fetched and
 * parsed once, while each caller receives a skeleton-safe clone. The manager
 * intentionally keeps zero-reference assets warm until an explicit unload so
 * a teacher switching maps does not pay the download cost twice.
 */
export class ArenaAssetManager {
  private readonly loader = new GLTFLoader();
  private readonly records = new Map<string, AssetRecord>();
  private readonly definitions = new Map<string, ArenaAssetDefinition>();
  private readonly packs = new Map<string, ArenaAssetPack>();
  private readonly listeners = new Set<AssetProgressListener>();
  private progress: ArenaAssetProgress = { loaded: 0, total: 0, failed: 0, active: 0 };

  constructor() {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    // GLTFLoader and TextureLoader can share browser responses across the
    // small set of map bundles without duplicating network work.
    THREE.Cache.enabled = true;
  }

  registerPack(pack: ArenaAssetPack) {
    this.packs.set(pack.id, pack);
    pack.assets.forEach((asset) => this.definitions.set(asset.id, asset));
  }

  subscribe(listener: AssetProgressListener) {
    this.listeners.add(listener);
    listener(this.progress);
    return () => this.listeners.delete(listener);
  }

  getProgress() {
    return { ...this.progress };
  }

  private notifyProgress() {
    const snapshot = this.getProgress();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private resolveDefinition(asset: string | ArenaAssetDefinition): ArenaAssetDefinition {
    if (typeof asset !== "string") return asset;
    return this.definitions.get(asset) ?? { id: asset, path: asset };
  }

  loadAsset(asset: string | ArenaAssetDefinition) {
    const definition = this.resolveDefinition(asset);
    const path = definition.path;
    const existing = this.records.get(path);
    if (existing) {
      existing.references += 1;
      return existing.promise;
    }

    this.progress = { ...this.progress, total: this.progress.total + 1, active: this.progress.active + 1 };
    const promise = this.loader.loadAsync(toUrl(path), (event) => {
      if (!event.total) return;
      // GLTFLoader's byte progress is useful for the debug panel, but it is
      // deliberately not treated as a completed asset until parsing finishes.
      this.notifyProgress();
    }).then((gltf) => {
      const normalizedScene = normalizeScene(gltf.scene);
      const record = this.records.get(path);
      if (record) record.source = normalizedScene;
      this.progress = {
        ...this.progress,
        loaded: this.progress.loaded + 1,
        active: Math.max(0, this.progress.active - 1)
      };
      this.notifyProgress();
      return normalizedScene;
    }).catch((error: unknown) => {
      const record = this.records.get(path);
      if (record) record.error = error;
      this.progress = {
        ...this.progress,
        failed: this.progress.failed + 1,
        active: Math.max(0, this.progress.active - 1)
      };
      this.notifyProgress();
      this.records.delete(path);
      throw error;
    });
    this.records.set(path, { path, promise, references: 1 });
    return promise;
  }

  getCachedAsset(idOrPath: string) {
    const definition = this.definitions.get(idOrPath);
    const path = definition?.path ?? idOrPath;
    return this.records.get(path)?.source;
  }

  async loadAssetPack(packId: string, detail = 2): Promise<ArenaAssetPackLoad> {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Unknown arena asset pack: ${packId}`);
    const selected = pack.assets.filter((asset) => (asset.minimumDetail ?? 0) <= detail);
    const results = await Promise.allSettled(selected.map((asset) => this.loadAsset(asset)));
    const assets = new Map<string, THREE.Group>();
    results.forEach((result, index) => {
      const asset = selected[index]!;
      if (result.status === "fulfilled") assets.set(asset.id, result.value);
    });
    let released = false;
    return {
      pack,
      assets,
      failed: results.filter((result) => result.status === "rejected").length,
      release: () => {
        if (released) return;
        released = true;
        selected.forEach((asset, index) => {
          if (results[index]?.status === "fulfilled") this.releaseAsset(asset);
        });
      }
    };
  }

  preloadAssetPack(packId: string, detail = 2) {
    return this.loadAssetPack(packId, detail);
  }

  releaseAsset(asset: string | ArenaAssetDefinition) {
    const definition = this.resolveDefinition(asset);
    const record = this.records.get(definition.path);
    if (record) record.references = Math.max(0, record.references - 1);
  }

  releaseAssetPack(packId: string, detail = 2) {
    const pack = this.packs.get(packId);
    if (!pack) return;
    pack.assets
      .filter((asset) => (asset.minimumDetail ?? 0) <= detail)
      .forEach((asset) => this.releaseAsset(asset));
  }

  unloadAsset(idOrPath: string) {
    const definition = this.definitions.get(idOrPath);
    const path = definition?.path ?? idOrPath;
    const record = this.records.get(path);
    if (!record || record.references > 0 || !record.source) return false;
    disposeOwnedScene(record.source);
    this.records.delete(path);
    return true;
  }

  unloadUnusedAssets() {
    let unloaded = 0;
    for (const [path, record] of this.records) {
      if (record.references > 0 || !record.source) continue;
      if (this.unloadAsset(path)) unloaded += 1;
    }
    return unloaded;
  }

  dispose() {
    this.records.forEach((record) => {
      if (record.source) disposeOwnedScene(record.source);
    });
    this.records.clear();
    this.listeners.clear();
    this.progress = { loaded: 0, total: 0, failed: 0, active: 0 };
  }
}

export const cloneArenaAsset = ({
  source,
  name,
  position,
  scale = 1,
  rotationY = 0,
  scaleVector
}: {
  source: THREE.Group;
  name: string;
  position: THREE.Vector3;
  scale?: number;
  rotationY?: number;
  scaleVector?: [number, number, number];
}) => {
  const instance = cloneSkeleton(source) as THREE.Group;
  instance.name = name;
  instance.position.copy(position);
  instance.rotation.y = rotationY;
  if (scaleVector) instance.scale.set(...scaleVector);
  else instance.scale.setScalar(scale);
  instance.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.preserveSharedResources = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return instance;
};

export const arenaAssetManager = new ArenaAssetManager();
