import * as THREE from "three";
import { instantiateArenaAsset, loadArenaAsset, releaseArenaAsset } from "./arenaAssetLoader";

export const ZEUS_MODEL_PATH = "/assets/zeus/zeus-ammon.glb";

export type ZeusModelAssets = {
  load: (path: string) => Promise<THREE.Group>;
  release: (path: string) => void;
};

const defaultAssets: ZeusModelAssets = { load: loadArenaAsset, release: releaseArenaAsset };

/** Geometry stays in the arena cache; each apparition owns only its materials.
 * A late download must never attach to an arena that has already unmounted. */
export const attachZeusModel = (head: THREE.Group, sky: THREE.Group, layer: number, assets = defaultAssets) => {
  let disposed = false;
  let instance: THREE.Group | undefined;
  const materials = new Map<THREE.Material, THREE.Material>();
  sky.userData.modelStatus = "loading";
  const ready = assets.load(ZEUS_MODEL_PATH).then((source) => {
    if (disposed) return;
    // The museum scan faces -Z; our STOP pose faces the camera along +Z.
    instance = instantiateArenaAsset({ source, name: "athletics-zeus-model", position: new THREE.Vector3(), rotationY: Math.PI });
    instance.traverse((object) => {
      object.layers.set(layer);
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = false;
      const copyMaterial = (original: THREE.Material) => {
        let copy = materials.get(original);
        if (!copy) {
          copy = original.clone();
          if ("fog" in copy) copy.fog = false;
          materials.set(original, copy);
        }
        return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(copyMaterial) : copyMaterial(object.material);
    });
    head.add(instance);
    sky.userData.modelStatus = "ready";
  }).catch(() => {
    if (!disposed) sky.userData.modelStatus = "unavailable";
    // The independent GO/STOP signal still works if an asset cannot load.
  });
  return {
    ready,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      instance?.removeFromParent();
      materials.forEach((material) => material.dispose());
      materials.clear();
      assets.release(ZEUS_MODEL_PATH);
      sky.userData.modelStatus = "disposed";
    }
  };
};
