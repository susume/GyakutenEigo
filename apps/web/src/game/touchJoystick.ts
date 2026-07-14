export interface TouchJoystickBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TouchJoystickVector {
  forward: number;
  right: number;
  stickX: number;
  stickY: number;
}

export const resolveTouchJoystickVector = (
  clientX: number,
  clientY: number,
  bounds: TouchJoystickBounds
): TouchJoystickVector => {
  const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.34);
  const dx = clientX - (bounds.left + bounds.width / 2);
  const dy = clientY - (bounds.top + bounds.height / 2);
  const length = Math.hypot(dx, dy);
  const scale = length > radius ? radius / length : 1;
  const stickX = dx * scale;
  const stickY = dy * scale;

  return {
    forward: -stickY / radius,
    right: stickX / radius,
    stickX,
    stickY
  };
};
