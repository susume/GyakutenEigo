/** Rescale the radial dead zone instead of snapping axes at the threshold. */
export function radialStick(x = 0, y = 0, deadZone = .18) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  if (length <= deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (length - deadZone) / (1 - deadZone));
  return { x: x / length * magnitude, y: y / length * magnitude };
}

export function gamepadLookDelta(x: number, y: number, deltaSeconds: number, sensitivity = 1) {
  const stick = radialStick(x, y);
  const dt = Math.max(0, Math.min(.05, deltaSeconds));
  return { yaw: -stick.x * 3.3 * dt * sensitivity, pitch: -stick.y * 2.52 * dt * sensitivity };
}
