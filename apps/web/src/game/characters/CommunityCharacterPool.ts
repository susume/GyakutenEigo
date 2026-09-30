import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { COMMUNITY_CHARACTER } from "./communityCharacterAssets";

const assetUrl = (path: string) => `${import.meta.env?.BASE_URL ?? "/"}${path}`;
const disposeScene = (root: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

export class CommunityCharacterInstance {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private active?: THREE.AnimationAction;
  private released = false;
  private accumulatedDelta = 0;

  constructor(readonly scene: THREE.Object3D, clips: THREE.AnimationClip[], private readonly release: () => void) {
    scene.rotation.y += COMMUNITY_CHARACTER.forwardRotation;
    this.root.add(scene);
    this.mixer = new THREE.AnimationMixer(scene);
    clips.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      if (clip.name === "jump") { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      this.actions.set(clip.name, action);
    });
    this.play("idle");
  }

  private play(name: string) {
    const next = this.actions.get(name);
    if (!next || next === this.active) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this.active) next.crossFadeFrom(this.active, .18, false);
    this.active = next;
  }

  /** Network positions belong on root. Imported clips are strictly visual, with no root motion. */
  update(delta: number, speed: number, jumping = false, animate = true) {
    if (this.released) return;
    this.play(jumping ? "jump" : speed > .15 ? "run" : "idle");
    this.accumulatedDelta += Math.max(0, Math.min(.1, delta));
    if (!animate) return;
    this.mixer.update(this.accumulatedDelta);
    this.accumulatedDelta = 0;
  }

  dispose() {
    if (this.released) return;
    this.released = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.scene);
    this.scene.traverse((object) => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); });
    this.root.removeFromParent();
    this.release();
  }
}

/** One parsed prefab/texture per renderer scope, independent skeletons and mixers per player. */
export class CommunityCharacterPool {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private pending?: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>;
  private instances = new Set<CommunityCharacterInstance>();
  private disposed = false;

  private load() {
    if (!this.pending) this.pending = this.loader.loadAsync(assetUrl(COMMUNITY_CHARACTER.url)).then(async (gltf) => {
      let texture: THREE.Texture;
      try { texture = await new THREE.TextureLoader().loadAsync(assetUrl(COMMUNITY_CHARACTER.textureUrl)); }
      catch (error) { disposeScene(gltf.scene); throw error; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) { material.map = texture; material.needsUpdate = true; }
        });
      });
      if (this.disposed) { disposeScene(gltf.scene); throw new Error("Character pool disposed during loading"); }
      return { scene: gltf.scene, animations: gltf.animations };
    }).catch((error: unknown) => { this.pending = undefined; throw error; });
    return this.pending;
  }

  async create() {
    if (this.disposed) throw new Error("Character pool is disposed");
    const source = await this.load();
    if (this.disposed) throw new Error("Character pool is disposed");
    const instance = new CommunityCharacterInstance(cloneSkeleton(source.scene), source.animations, () => this.instances.delete(instance));
    this.instances.add(instance);
    return instance;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.instances.forEach((instance) => instance.dispose());
    // Successful assets are released here; in-flight loads release themselves above.
    void this.pending?.then((source) => disposeScene(source.scene)).catch(() => undefined);
  }
}
