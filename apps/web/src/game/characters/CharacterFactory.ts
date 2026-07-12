import * as THREE from "three";
import type { Team } from "@quizstrike/shared";
import { resolveCharacterAppearance, type CharacterAppearance } from "./CharacterAppearance.js";
import { createBackpack, createWeaponSet, type CharacterMaterials } from "./CharacterEquipment.js";
import { CharacterModel } from "./CharacterModel.js";

export interface FirstPersonViewModel {
  root: THREE.Group;
  weapon: THREE.Object3D;
  muzzle: THREE.Object3D;
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
  private readonly headGeometry = new THREE.DodecahedronGeometry(0.5, 0);
  private readonly helmetGeometry = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.72);
  private readonly materialCache = new Map<string, THREE.MeshStandardMaterial>();

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
      skin: this.material(appearance.palette.skin, 0.78)
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

  createCharacter(input: { playerId: string; team: Team; gear?: string }) {
    const appearance = resolveCharacterAppearance(input);
    const materials = this.materialsFor(appearance);
    const root = new THREE.Group();
    root.scale.set(
      appearance.silhouette.widthScale * CHARACTER_VISUAL_SCALE,
      appearance.silhouette.heightScale * CHARACTER_VISUAL_SCALE,
      appearance.silhouette.widthScale * CHARACTER_VISUAL_SCALE
    );

    const hips = this.addBox(root, materials.uniform, [0, 0.72, 0], [0.56, 0.28, 0.34]);
    const torso = this.addBox(root, materials.uniform, [0, 1.16, 0], [0.66, 0.68, 0.36]);
    this.addBox(root, materials.armor, [0, 1.18, -0.03], [0.72, 0.58, 0.22]);
    this.addBox(root, materials.accent, [0.29, 1.34, -0.17], [0.08, 0.18, 0.035]);

    const head = new THREE.Mesh(this.headGeometry, materials.skin);
    head.position.set(0, 1.68, -0.02);
    head.scale.set(0.34, 0.42, 0.32);
    head.castShadow = true;
    root.add(head);

    const helmet = new THREE.Mesh(this.helmetGeometry, materials.armor);
    helmet.position.set(0, 1.79, -0.02);
    helmet.scale.set(0.46, 0.32, 0.42);
    helmet.rotation.y = appearance.silhouette.helmet === "ridge" ? 0.12 : 0;
    helmet.castShadow = true;
    root.add(helmet);
    if (appearance.silhouette.helmet === "hood") {
      this.addBox(root, materials.cloth, [0, 1.7, 0.08], [0.54, 0.52, 0.34]);
    } else {
      this.addBox(root, materials.visor, [0, 1.71, -0.29], [0.42, 0.12, 0.035]);
    }
    if (appearance.silhouette.helmet === "ridge") {
      this.addBox(root, materials.accent, [0, 1.99, -0.02], [0.08, 0.08, 0.54]);
    }

    const shoulderScale = appearance.silhouette.shoulderBulk;
    this.addBox(root, materials.armor, [-0.48, 1.38, 0], [0.22 * shoulderScale, 0.18, 0.42]);
    this.addBox(root, materials.armor, [0.48, 1.38, 0], [0.22 * shoulderScale, 0.18, 0.42]);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.48, 1.22, -0.02);
    root.add(leftArm);
    this.addBox(leftArm, materials.uniform, [0, -0.18, 0], [0.2, 0.54, 0.2], [-0.16, 0, -0.08]);
    this.addBox(leftArm, materials.dark, [0, -0.5, -0.02], [0.2, 0.18, 0.2]);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.48, 1.22, -0.02);
    root.add(rightArm);
    this.addBox(rightArm, materials.uniform, [0, -0.16, 0], [0.2, 0.56, 0.2], [-0.32, 0, 0.08]);
    this.addBox(rightArm, materials.dark, [0, -0.5, -0.02], [0.2, 0.18, 0.2]);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.2, 0.62, 0);
    root.add(leftLeg);
    this.addBox(leftLeg, materials.uniform, [0, -0.2, 0], [0.22, 0.54, 0.24]);
    this.addBox(leftLeg, materials.dark, [0, -0.58, -0.02], [0.26, 0.22, 0.3]);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.2, 0.62, 0);
    root.add(rightLeg);
    this.addBox(rightLeg, materials.uniform, [0, -0.2, 0], [0.22, 0.54, 0.24]);
    this.addBox(rightLeg, materials.dark, [0, -0.58, -0.02], [0.26, 0.22, 0.3]);

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

    this.addBox(root, materials.dark, [0, 0.86, -0.19], [0.72, 0.08, 0.06]);
    this.addBox(root, materials.accent, [-0.26, 0.86, -0.22], [0.08, 0.08, 0.04]);

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

    this.addBox(root, materials.uniform, [-0.28, -0.16, -0.18], [0.14, 0.42, 0.14], [-0.64, 0.12, 0.08]);
    this.addBox(root, materials.uniform, [0.32, -0.12, -0.12], [0.14, 0.46, 0.14], [-0.7, -0.08, -0.04]);
    this.addBox(root, materials.dark, [-0.24, -0.4, -0.42], [0.16, 0.12, 0.16], [-0.64, 0.12, 0.08]);
    this.addBox(root, materials.dark, [0.36, -0.36, -0.38], [0.16, 0.12, 0.16], [-0.7, -0.08, -0.04]);

    const { weapon, muzzle } = createWeaponSet(materials, this.boxGeometry, gear);
    weapon.position.set(0.06, -0.24, -0.62);
    weapon.rotation.set(-0.1, Math.PI, 0);
    weapon.scale.set(0.62, 0.62, 0.82);
    root.add(weapon);
    return { root, weapon, muzzle };
  }
}
