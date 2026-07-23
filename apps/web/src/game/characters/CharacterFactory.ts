import * as THREE from "three";
import type { PlayerAppearance, Team } from "@quizstrike/shared";
import { resolveCharacterAppearance, type CharacterAppearance } from "./CharacterAppearance.js";
import { createBackpack, createWeaponSet, type CharacterMaterials } from "./CharacterEquipment.js";
import { CharacterModel } from "./CharacterModel.js";
import { createSharedSkinnedStudent } from "./SharedSkinnedStudent.js";

export interface FirstPersonViewModel {
  root: THREE.Group;
  weapon: THREE.Object3D;
  muzzle: THREE.Object3D;
}

export interface CharacterFactoryOptions {
  loadDecalTexture?: (assetId: string) => Promise<THREE.Texture | null>;
}

const CHARACTER_VISUAL_SCALE = 2.45;

const makeMaterial = (color: string, roughness = 0.82, metalness = 0.03) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true
  });

export class CharacterFactory {
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly headGeometry = new THREE.SphereGeometry(0.5, 12, 8);
  private readonly helmetGeometry = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.72);
  private readonly torsoGeometry = new THREE.CylinderGeometry(0.42, 0.34, 0.78, 8);
  private readonly limbGeometry = new THREE.CylinderGeometry(0.13, 0.105, 0.62, 8);
  private readonly jointGeometry = new THREE.SphereGeometry(0.14, 8, 6);
  private readonly shadowGeometry = new THREE.CircleGeometry(0.52, 16);
  private readonly roundEyewearGeometry = new THREE.TorusGeometry(0.105, 0.026, 6, 12);
  private readonly materialCache = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private readonly options: CharacterFactoryOptions = {}) {}

  dispose() {
    this.boxGeometry.dispose();
    this.headGeometry.dispose();
    this.helmetGeometry.dispose();
    this.torsoGeometry.dispose();
    this.limbGeometry.dispose();
    this.jointGeometry.dispose();
    this.shadowGeometry.dispose();
    this.roundEyewearGeometry.dispose();
    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
  }

  private material(color: string, roughness = 0.82, metalness = 0.03) {
    const key = `${color}-${roughness}-${metalness}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;
    const material = makeMaterial(color, roughness, metalness);
    this.materialCache.set(key, material);
    return material;
  }

  private materialsFor(appearance: CharacterAppearance): CharacterMaterials {
    return {
      uniform: this.material(appearance.palette.uniform, 0.86),
      armor: this.material(appearance.palette.armor, 0.72, 0.04),
      cloth: this.material(appearance.palette.cloth, 0.92),
      accent: this.material(appearance.palette.accent, 0.62, 0.05),
      dark: this.material(appearance.palette.dark, 0.8, 0.06),
      visor: this.material(appearance.palette.visor, 0.38, 0.12),
      skin: this.material(appearance.palette.skin, 0.78),
      backpack: this.material(appearance.customization.backpackColor, 0.9)
    };
  }

  private addBox(
    parent: THREE.Object3D,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0]
  ) {
    const mesh = new THREE.Mesh(this.boxGeometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addShape(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0]
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  createCharacter(input: { playerId: string; team: Team; gear?: string; appearance?: PlayerAppearance }) {
    const appearance = resolveCharacterAppearance(input);
    const materials = this.materialsFor(appearance);
    const root = new THREE.Group();
    root.scale.set(
      appearance.silhouette.widthScale * CHARACTER_VISUAL_SCALE,
      appearance.silhouette.heightScale * CHARACTER_VISUAL_SCALE,
      appearance.silhouette.widthScale * CHARACTER_VISUAL_SCALE
    );

    const contactShadow = new THREE.Mesh(
      this.shadowGeometry,
      new THREE.MeshBasicMaterial({ color: "#06121c", transparent: true, opacity: 0.22, depthWrite: false })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    contactShadow.userData.disposeWithCharacterMaterial = true;
    root.add(contactShadow);
    const athlete = createSharedSkinnedStudent(appearance, materials);
    root.add(athlete.mesh);
    const { torso, head, leftArm, rightArm, leftLeg, rightLeg } = athlete.bones;

    // Small silhouette accessories remain bone-attached so every class shares the same
    // body skin and animation rig without losing readable role identity.
    if (appearance.silhouette.helmet === "hood") {
      this.addShape(head, new THREE.TorusGeometry(0.38, 0.085, 7, 14), materials.cloth, [0, 0, 0.04], [1, 1.18, 1], [Math.PI / 2, 0, 0]).userData.disposeWithCharacterGeometry = true;
    }
    if (appearance.silhouette.helmet === "ridge") {
      this.addShape(head, new THREE.ConeGeometry(0.16, 0.36, 7), materials.dark, [0, 0.29, 0.05], [1, 1, 1], [0.08, 0, -0.08]).userData.disposeWithCharacterGeometry = true;
    }
    if (appearance.silhouette.helmet === "headset") {
      this.addShape(head, new THREE.TorusGeometry(0.37, 0.045, 6, 12, Math.PI), materials.dark, [0, 0.06, 0.02], [1, 1.1, 1], [0, 0, Math.PI / 2]).userData.disposeWithCharacterGeometry = true;
    }
    if (appearance.customization.eyewearStyle !== "none") {
      const eyewearMaterial = this.material(appearance.customization.eyewearColor, 0.42, 0.12);
      const lensGeometry = appearance.customization.eyewearStyle === "goggles" ? this.boxGeometry : this.roundEyewearGeometry;
      const lensScale: [number, number, number] = appearance.customization.eyewearStyle === "goggles"
        ? [0.23, 0.11, 0.035]
        : [1, 1, 1];
      for (const x of [-0.13, 0.13]) {
        this.addShape(head, lensGeometry, eyewearMaterial, [x, 0, -0.35], lensScale, [0, 0, 0]);
      }
      this.addShape(head, this.boxGeometry, eyewearMaterial, [0, 0, -0.355], [0.08, 0.025, 0.02]);
    }

    const { weapon, muzzle } = createWeaponSet(materials, this.boxGeometry, input.gear);
    weapon.position.set(0.2, 1.14, -0.5);
    weapon.rotation.set(-0.24, Math.PI, -0.04);
    weapon.scale.setScalar(0.72);
    root.add(weapon);

    const backpack = createBackpack(appearance, materials, this.boxGeometry);
    if (backpack) {
      backpack.position.set(0, 1.16, 0.28);
      root.add(backpack);
    }

    if (appearance.customization.decalAssetId && this.options.loadDecalTexture) {
      const decalMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), decalMaterial);
      decal.position.set(0, 1.28, -0.385);
      decal.rotation.y = Math.PI;
      decal.visible = false;
      decal.userData.ownedDecalMaterial = true;
      decal.userData.disposeWithCharacterGeometry = true;
      root.add(decal);
      void this.options.loadDecalTexture(appearance.customization.decalAssetId).then((texture) => {
        if (!texture) return;
        if (root.userData.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 2;
        decalMaterial.map = texture;
        decalMaterial.needsUpdate = true;
        decal.visible = true;
      }).catch(() => undefined);
    }

    return new CharacterModel(appearance, {
      root,
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      weapon,
      equipment: { weapon, muzzle, backpack }
    });
  }

  createFirstPersonViewModel(team: Team, gear = "starter_blaster"): FirstPersonViewModel {
    const appearance = resolveCharacterAppearance({ team, playerId: "local", gear, variant: "assault" });
    const materials = this.materialsFor(appearance);
    const root = new THREE.Group();
    root.position.set(0.34, -0.58, -1.02);
    root.rotation.set(-0.04, -0.08, 0);

    this.addShape(root, this.limbGeometry, materials.uniform, [-0.28, -0.17, -0.18], [0.92, 0.72, 0.92], [-0.64, 0.12, 0.08]);
    this.addShape(root, this.limbGeometry, materials.uniform, [0.32, -0.13, -0.12], [0.92, 0.78, 0.92], [-0.7, -0.08, -0.04]);
    this.addShape(root, this.jointGeometry, materials.dark, [-0.24, -0.42, -0.42], [0.9, 0.9, 0.9]);
    this.addShape(root, this.jointGeometry, materials.dark, [0.36, -0.38, -0.38], [0.9, 0.9, 0.9]);

    const { weapon, muzzle } = createWeaponSet(materials, this.boxGeometry, gear);
    weapon.position.set(0.06, -0.24, -0.62);
    weapon.rotation.set(-0.1, Math.PI, 0);
    weapon.scale.set(0.62, 0.62, 0.82);
    root.add(weapon);
    return { root, weapon, muzzle };
  }
}
