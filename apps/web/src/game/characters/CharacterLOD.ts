import * as THREE from "three";
import { CHARACTER_LOD_LEVELS } from "./CharacterAppearance.js";

export type CharacterLODName = (typeof CHARACTER_LOD_LEVELS)[number]["name"];

export const getCharacterLOD = (distance: number) =>
  CHARACTER_LOD_LEVELS.find((level) => distance <= level.maxDistance) ?? CHARACTER_LOD_LEVELS[CHARACTER_LOD_LEVELS.length - 1];

export class CharacterLOD {
  private frameIndex = 0;
  level: CharacterLODName = "LOD0";

  update(root: THREE.Object3D, camera: THREE.Camera) {
    const distance = root.position.distanceTo(camera.position);
    const nextLevel = getCharacterLOD(distance);
    this.level = nextLevel.name;
    this.frameIndex = (this.frameIndex + 1) % nextLevel.animationStep;
    return {
      level: nextLevel,
      shouldAnimate: this.frameIndex === 0
    };
  }
}
