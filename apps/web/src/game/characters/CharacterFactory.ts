import * as THREE from "three";
import type { PlayerAppearance, Team } from "@quizstrike/shared";
import {
  BACK_ACCESSORY_DEFINITIONS,
  DETAIL_ACCESSORY_DEFINITIONS,
  createBackAccessory,
  createDetailAccessory,
  type AccessorySocketName
} from "./CharacterAccessories.js";
import { createHeadStyle, createHeadStyleDebugEnvelope } from "./CharacterHeadStyles.js";
import { resolveCharacterAppearance, type CharacterAppearance } from "./CharacterAppearance.js";
import {
  createWeaponSet,
  getWeaponMountTransform,
  type CharacterMaterials
} from "./CharacterEquipment.js";
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
    flatShading: false
  });

export class CharacterFactory {
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly limbGeometry = new THREE.CylinderGeometry(0.13, 0.105, 0.62, 8);
  private readonly jointGeometry = new THREE.SphereGeometry(0.14, 8, 6);
  private readonly shadowGeometry = new THREE.CircleGeometry(0.52, 16);
  private readonly materialCache = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private readonly options: CharacterFactoryOptions = {}) {}

  dispose() {
    this.boxGeometry.dispose();
    this.limbGeometry.dispose();
    this.jointGeometry.dispose();
    this.shadowGeometry.dispose();
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
    const flatGreySilhouette = typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("characterSilhouette") === "1";
    if (flatGreySilhouette) {
      const silhouetteMaterial = this.material("#9aa3ad", 0.9);
      return {
        uniform: silhouetteMaterial,
        armor: silhouetteMaterial,
        cloth: silhouetteMaterial,
        accent: silhouetteMaterial,
        dark: silhouetteMaterial,
        visor: silhouetteMaterial,
        skin: silhouetteMaterial
      };
    }
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
    const {
      root: skeletonRoot,
      torso,
      head,
      leftArm,
      rightArm,
      leftForearm,
      rightForearm,
      rightHand,
      leftLeg,
      rightLeg,
      leftShin,
      rightShin
    } = athlete.bones;

    const socketParents: Record<AccessorySocketName, THREE.Object3D> = {
      HeadSocket: head,
      FaceSocket: head,
      BackSocket: torso,
      ShoulderSocket: leftArm,
      ChestBadgeSocket: torso,
      WristSocket: leftForearm,
      HipSocket: skeletonRoot
    };
    const socketOffsets: Record<AccessorySocketName, [number, number, number]> = {
      HeadSocket: [0, 0, 0],
      FaceSocket: [0, 0.04, -0.3],
      BackSocket: [0, 0.04, 0.28],
      ShoulderSocket: [0, 0, -0.1],
      ChestBadgeSocket: [0, 0.12, -0.325],
      WristSocket: [0, -0.19, -0.1],
      HipSocket: [0.29, 0.8, 0]
    };
    const accessorySockets = {} as Record<AccessorySocketName, THREE.Group>;
    (Object.keys(socketParents) as AccessorySocketName[]).forEach((name) => {
      const socket = new THREE.Group();
      socket.name = name;
      socket.position.set(...socketOffsets[name]);
      socketParents[name].add(socket);
      accessorySockets[name] = socket;
    });

    const activeHeadStyle = createHeadStyle(appearance.customization.headStyleId, materials);
    accessorySockets.HeadSocket.add(activeHeadStyle);
    root.userData.activeHeadStyleId = activeHeadStyle.userData.headStyleId;
    const accessories: THREE.Object3D[] = [];
    const backDefinition = BACK_ACCESSORY_DEFINITIONS[appearance.customization.backAccessoryId];
    const backAccessory = createBackAccessory(appearance.customization.backAccessoryId, materials);
    if (backAccessory) {
      accessorySockets[backDefinition.socket].add(backAccessory);
      accessories.push(backAccessory);
    }
    const detailDefinition = DETAIL_ACCESSORY_DEFINITIONS[appearance.customization.detailAccessoryId];
    const detailAccessory = createDetailAccessory(appearance.customization.detailAccessoryId, materials);
    if (detailAccessory) {
      accessorySockets[detailDefinition.socket].add(detailAccessory);
      accessories.push(detailAccessory);
    }

    const gearId = input.gear ?? "starter_blaster";
    const { weapon, muzzle, leftHandSupport } = createWeaponSet(materials, this.boxGeometry, gearId);
    const mount = getWeaponMountTransform(gearId);
    const weaponSocket = new THREE.Group();
    weaponSocket.name = "RightHandWeaponSocket";
    rightHand.add(weaponSocket);
    weapon.position.set(...mount.position);
    weapon.rotation.set(...mount.rotation);
    weapon.scale.setScalar(mount.scale);
    weapon.userData.mountPosition = [...mount.position];
    weapon.userData.mountRotation = [...mount.rotation];
    weaponSocket.add(weapon);

    const showSockets = typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("characterSockets") === "1";
    if (showSockets) {
      weaponSocket.add(new THREE.AxesHelper(0.22));
      leftHandSupport.add(new THREE.AxesHelper(0.2));
      rightHand.add(new THREE.AxesHelper(0.18));
      Object.values(accessorySockets).forEach((socket) => socket.add(new THREE.AxesHelper(0.14)));
      accessorySockets.HeadSocket.add(createHeadStyleDebugEnvelope());
    }

    if (appearance.customization.decalAssetId && this.options.loadDecalTexture) {
      const decalMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), decalMaterial);
      decal.rotation.y = Math.PI;
      decal.visible = false;
      decal.userData.ownedDecalMaterial = true;
      decal.userData.disposeWithCharacterGeometry = true;
      accessorySockets.ChestBadgeSocket.add(decal);
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
      leftForearm,
      rightForearm,
      leftLeg,
      rightLeg,
      leftShin,
      rightShin,
      weapon,
      equipment: { weapon, muzzle, weaponSocket, leftHandSupport, accessories }
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
