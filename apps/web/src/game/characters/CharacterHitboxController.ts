import * as THREE from "three";
import { CHARACTER_HITBOXES } from "./CharacterAppearance.js";

export type CharacterHitRegion = keyof typeof CHARACTER_HITBOXES;

export interface CharacterHitbox {
  region: CharacterHitRegion;
  damageMultiplier: number;
  box: THREE.Box3;
}

export class CharacterHitboxController {
  private readonly hitboxes = Object.entries(CHARACTER_HITBOXES).map(([region, spec]) => ({
    region: region as CharacterHitRegion,
    damageMultiplier: spec.damageMultiplier,
    box: new THREE.Box3(),
    centerY: spec.centerY,
    radius: spec.radius,
    height: spec.height
  }));

  update(position: THREE.Vector3, heightScale = 1): CharacterHitbox[] {
    for (const hitbox of this.hitboxes) {
      const centerY = hitbox.centerY * heightScale;
      const halfHeight = (hitbox.height * heightScale) / 2;
      hitbox.box.min.set(position.x - hitbox.radius, position.y + centerY - halfHeight, position.z - hitbox.radius);
      hitbox.box.max.set(position.x + hitbox.radius, position.y + centerY + halfHeight, position.z + hitbox.radius);
    }
    return this.hitboxes;
  }
}
