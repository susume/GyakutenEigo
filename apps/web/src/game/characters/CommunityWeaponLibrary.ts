import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getWeaponMountTransform } from "./CharacterEquipment";

/** One cached static prefab per weapon, shared geometry/materials across the entire class. */
export class CommunityWeaponLibrary {
  private readonly prefabs = new Map<string, Promise<THREE.Group>>();
  private disposed = false;
  private warned = false;

  async attach(weapon: THREE.Object3D, gearId: string) {
    const file = gearId === "power_blaster" ? "blaster-n" : gearId === "quick_blaster" ? "blaster-h" : "blaster-a";
    try {
      let pending = this.prefabs.get(file);
      if (!pending) {
        pending = new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL ?? "/"}assets/community/kenney-blasters/${file}.glb`).then(gltf => {
          const prefab = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(prefab), size = bounds.getSize(new THREE.Vector3());
          const calibration = getWeaponMountTransform(gearId);
          // Kenney barrels point +Z. Keep original grip/muzzle contracts, including heavy-gun zoom.
          const scale = (calibration.muzzle[2] + .62) / size.z;
          prefab.scale.setScalar(scale);
          prefab.position.set(-bounds.getCenter(new THREE.Vector3()).x * scale, calibration.muzzle[1] - bounds.max.y * scale + .08, calibration.muzzle[2] - bounds.max.z * scale);
          prefab.name = `Kenney_${file}`;
          prefab.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.userData.preserveSharedResources = true;
            object.castShadow = true; object.receiveShadow = true;
          });
          return prefab;
        });
        this.prefabs.set(file, pending);
      }
      const prefab = await pending;
      if (this.disposed || weapon.userData.disposed) return;
      for (const child of weapon.children) if (child instanceof THREE.Mesh) {
        child.visible = false;
        // CharacterLOD can toggle legacy detail visibility; disabled layers keep its fallback out of the render.
        child.layers.disableAll();
      }
      weapon.add(prefab.clone(true));
      weapon.userData.assetSource = `kenney-${file}`;
    } catch (error) {
      if (!this.disposed && !this.warned) { this.warned = true; console.warn("[QuizStrike] community blaster unavailable; keeping built-in fallback", error); }
    }
  }

  private release(root: THREE.Object3D) {
    const resources = new Set<{ dispose(): void }>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
      }
    });
    resources.forEach(resource => resource.dispose());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.prefabs.values()) void pending.then(prefab => this.release(prefab)).catch(() => undefined);
    this.prefabs.clear();
  }
}
