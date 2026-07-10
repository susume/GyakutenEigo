export const CHARACTER_VISUAL_SCALE = 2.45;
export const BASE_STANDING_EYE_HEIGHT = 1.72;
export const BASE_CROUCH_EYE_HEIGHT = 1.08;

export const FPS_STANDING_EYE_HEIGHT = Number((BASE_STANDING_EYE_HEIGHT * CHARACTER_VISUAL_SCALE).toFixed(2));
export const FPS_CROUCH_EYE_HEIGHT = Number((BASE_CROUCH_EYE_HEIGHT * CHARACTER_VISUAL_SCALE).toFixed(2));
export const FPS_BODY_HEIGHT = Number((2.05 * CHARACTER_VISUAL_SCALE).toFixed(2));

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
  clearance = 0.12
) => body.minY > obstacleTopY + clearance;
