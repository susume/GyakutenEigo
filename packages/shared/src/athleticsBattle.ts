import { ATHLETICS_PLAYER_EYE_HEIGHT, ATHLETICS_PLAYER_RADIUS } from "./athleticsRace.js";

/** Shared, server-owned rules for the optional battle layer in every Athletics mode. */
export const ATHLETICS_BATTLE_ENERGY_COST = 100;
export const ATHLETICS_BATTLE_CHARGE_MS = 3000;
export const ATHLETICS_BATTLE_CHARGE_EXPIRES_MS = 6000;
export const ATHLETICS_BATTLE_STUN_MS = 2500;
/** A short grace after recovery prevents several classmates from chaining a stun. */
export const ATHLETICS_BATTLE_IMMUNITY_MS = 1000;
export const ATHLETICS_BATTLE_SPEED = 46;
export const ATHLETICS_BATTLE_RANGE = 80;
/** The solid projectile core; the surrounding glow and trail cannot score hits. */
export const ATHLETICS_BATTLE_RADIUS = 0.22;

export type AthleticsBattleAction = "battle_charge" | "battle_cancel" | "battle_fire";
export interface AthleticsBattlePoint { x: number; y: number; z: number }
export interface AthleticsBattleBlast {
  id: string;
  playerId: string;
  origin: AthleticsBattlePoint;
  /** Unit launch direction, fixed when fired. Never steers toward a player. */
  direction: AthleticsBattlePoint;
  launchedAt: number;
  /** Last distance checked by the server, to avoid tunneling between ticks. */
  distance: number;
}

export const getAthleticsBattleBlastPosition = (blast: AthleticsBattleBlast, nowMs: number): AthleticsBattlePoint => {
  const distance = Math.min(ATHLETICS_BATTLE_RANGE, Math.max(0, nowMs - blast.launchedAt) * ATHLETICS_BATTLE_SPEED / 1000);
  return {
    x: blast.origin.x + blast.direction.x * distance,
    y: blast.origin.y + blast.direction.y * distance,
    z: blast.origin.z + blast.direction.z * distance
  };
};

/** Swept sphere vs a rounded body capsule; near misses never become assisted hits. */
export const getAthleticsBattleBodyContact = (
  from: AthleticsBattlePoint,
  to: AthleticsBattlePoint,
  eye: AthleticsBattlePoint,
  crouching = false
): number | undefined => {
  const radius = ATHLETICS_PLAYER_RADIUS + ATHLETICS_BATTLE_RADIUS;
  const bottom = eye.y - (crouching ? 2.65 : ATHLETICS_PLAYER_EYE_HEIGHT) + 0.08 + ATHLETICS_PLAYER_RADIUS;
  const top = eye.y + 0.4 - ATHLETICS_PLAYER_RADIUS;
  const x = from.x - eye.x;
  const z = from.z - eye.z;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const nearestY = Math.max(bottom, Math.min(top, from.y));
  if (x * x + z * z + (from.y - nearestY) ** 2 <= radius * radius) return 0;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared < 1e-12) return undefined;
  let first: number | undefined;
  const accept = (fraction: number) => {
    if (fraction >= 0 && fraction <= 1 && (first === undefined || fraction < first)) first = fraction;
  };
  // The capsule is a finite cylinder with a sphere at either end. Check the
  // whole swept segment so a fast blast cannot tunnel through a direct hit.
  const horizontalLengthSquared = dx * dx + dz * dz;
  if (horizontalLengthSquared > 1e-12) {
    const b = x * dx + z * dz;
    const c = x * x + z * z - radius * radius;
    const discriminant = b * b - horizontalLengthSquared * c;
    if (discriminant >= 0) {
      for (const sign of [-1, 1]) {
        const fraction = (-b + sign * Math.sqrt(discriminant)) / horizontalLengthSquared;
        const y = from.y + dy * fraction;
        if (y >= bottom && y <= top) accept(fraction);
      }
    }
  }
  for (const centerY of [bottom, top]) {
    const y = from.y - centerY;
    const b = x * dx + y * dy + z * dz;
    const c = x * x + y * y + z * z - radius * radius;
    const discriminant = b * b - lengthSquared * c;
    if (discriminant >= 0) accept((-b - Math.sqrt(discriminant)) / lengthSquared);
  }
  return first;
};
