export const CHARACTER_VISUAL_SCALE = 2.45;
export const BASE_STANDING_EYE_HEIGHT = 1.72;
export const BASE_CROUCH_EYE_HEIGHT = 1.08;

export const FPS_STANDING_EYE_HEIGHT = Number((BASE_STANDING_EYE_HEIGHT * CHARACTER_VISUAL_SCALE).toFixed(2));
export const FPS_CROUCH_EYE_HEIGHT = Number((BASE_CROUCH_EYE_HEIGHT * CHARACTER_VISUAL_SCALE).toFixed(2));
export const FPS_BODY_HEIGHT = Number((2.05 * CHARACTER_VISUAL_SCALE).toFixed(2));
// A high initial impulse and stronger gravity preserve the useful cover-clearing
// apex while removing the long, floaty hang time of the previous 11/18 profile.
export const FPS_JUMP_VELOCITY = 15.5;
export const FPS_JUMP_GRAVITY = 36;
export const FPS_JUMP_APEX_HEIGHT = Number(
  ((FPS_JUMP_VELOCITY * FPS_JUMP_VELOCITY) / (2 * FPS_JUMP_GRAVITY)).toFixed(2)
);
export const FPS_JUMP_AIRTIME_SECONDS = Number(
  ((FPS_JUMP_VELOCITY * 2) / FPS_JUMP_GRAVITY).toFixed(3)
);
export const FPS_GROUNDED_CAMERA_RESPONSE = 18;
// Physical stair treads remain collision surfaces, but the body reaches the
// next riser slightly before its center crosses onto that tread. This allowance
// lets authored stairs behave like stairs without making ordinary cover
// automatically climbable.
export const FPS_MAX_AUTO_STEP_HEIGHT = 0.8;

/**
 * Smooths only the rendered eye height while grounded. Collision and server
 * position still use the exact authored stair, so the camera reads as an
 * arcade-FPS incline without reintroducing slippery ramp collision.
 */
export const smoothFpsGroundedCameraY = (
  currentY: number,
  targetY: number,
  deltaSeconds: number,
  response = FPS_GROUNDED_CAMERA_RESPONSE
) => {
  if (deltaSeconds <= 0 || Math.abs(targetY - currentY) > 4.5) return targetY;
  const alpha = 1 - Math.exp(-response * Math.min(deltaSeconds, 0.05));
  return currentY + (targetY - currentY) * alpha;
};

export const getFpsBodyVerticalBounds = (eyeY: number, floorEyeHeight: number) => {
  const lift = Math.max(0, eyeY - floorEyeHeight);
  const minY = Number((0.08 + lift).toFixed(2));
  return {
    minY,
    maxY: Number((minY + FPS_BODY_HEIGHT).toFixed(2))
  };
};

export const canFpsBodyClearObstacle = (
  body: ReturnType<typeof getFpsBodyVerticalBounds>,
  obstacleTopY: number,
  clearance = 0.04
) => body.minY >= obstacleTopY + clearance;

export const canFpsBodyAutoStepOnto = (
  body: ReturnType<typeof getFpsBodyVerticalBounds>,
  obstacleTopY: number,
  maximumStepHeight = FPS_MAX_AUTO_STEP_HEIGHT
) => obstacleTopY - body.minY <= maximumStepHeight;

export type FpsSupportSurface = {
  min: { x: number; y?: number; z: number };
  max: { x: number; y: number; z: number };
  /** Optional exact footprint for an Athletics platform; map boxes stay AABB. */
  footprint?: { x: number; z: number; width: number; depth: number; rotationY?: number };
};

const isPointWithinFpsSurface = (
  surface: FpsSupportSurface,
  x: number,
  z: number,
  radius: number
) => {
  if (!surface.footprint) {
    return !(x + radius < surface.min.x
      || x - radius > surface.max.x
      || z + radius < surface.min.z
      || z - radius > surface.max.z);
  }
  const angle = surface.footprint.rotationY ?? 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const offsetX = x - surface.footprint.x;
  const offsetZ = z - surface.footprint.z;
  const localX = cosine * offsetX - sine * offsetZ;
  const localZ = sine * offsetX + cosine * offsetZ;
  return Math.abs(localX) <= surface.footprint.width / 2 + radius
    && Math.abs(localZ) <= surface.footprint.depth / 2 + radius;
};

/** Exact oriented-footprint overlap used by the Athletics client collider. */
export const intersectsFpsBody = (
  surface: FpsSupportSurface,
  bodyBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }
) => {
  if (bodyBox.max.y < (surface.min.y ?? Number.NEGATIVE_INFINITY) || bodyBox.min.y > surface.max.y) return false;
  const radius = Math.max((bodyBox.max.x - bodyBox.min.x) / 2, (bodyBox.max.z - bodyBox.min.z) / 2);
  return isPointWithinFpsSurface(surface, (bodyBox.min.x + bodyBox.max.x) / 2, (bodyBox.min.z + bodyBox.max.z) / 2, radius);
};

/**
 * Finds the highest collision-box top crossed by the player's feet.
 * Horizontal radius overlap keeps the player supported until their whole body
 * has moved beyond an object's edge.
 */
export const findFpsSupportSurfaceY = (
  surfaces: readonly FpsSupportSurface[],
  x: number,
  z: number,
  radius: number,
  previousFootY: number,
  nextFootY: number,
  tolerance = 0.12
) => {
  const lowerY = Math.min(previousFootY, nextFootY) - tolerance;
  const upperY = Math.max(previousFootY, nextFootY) + tolerance;
  let supportY: number | undefined;

  for (const surface of surfaces) {
    if (!isPointWithinFpsSurface(surface, x, z, radius)) continue;
    const topY = surface.max.y;
    if (topY < lowerY || topY > upperY) continue;
    if (supportY === undefined || topY > supportY) supportY = topY;
  }

  return supportY;
};
