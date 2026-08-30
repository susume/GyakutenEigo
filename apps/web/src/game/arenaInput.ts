export type CombatPointerAction = "fire" | "scope" | "none";

export const ATHLETICS_RUN_SPEED = 14.8;
export const ATHLETICS_CROUCH_SPEED = 6.4;

/** Athletics has one normal movement speed; Shift changes posture, not speed. */
export const resolveAthleticsMovementSpeed = ({
  crouching,
  hasMovementEnergy,
  gearSpeedMultiplier = 1
}: {
  crouching: boolean;
  hasMovementEnergy: boolean;
  gearSpeedMultiplier?: number;
}) => !hasMovementEnergy
  ? 0
  : (crouching ? ATHLETICS_CROUCH_SPEED : ATHLETICS_RUN_SPEED) * gearSpeedMultiplier;

export const resolveAthleticsCrouching = ({
  shiftPressed,
  touchCrouch = false
}: {
  shiftPressed: boolean;
  touchCrouch?: boolean;
}) => shiftPressed || touchCrouch;

export const isFireKeyboardEvent = ({ code, key }: { code: string; key: string }) =>
  code === "KeyF" || key.toLowerCase() === "f";

export const isScopeKeyboardEvent = ({
  code,
  key,
  repeat = false
}: {
  code: string;
  key: string;
  repeat?: boolean;
}) => !repeat && (code === "KeyC" || key.toLowerCase() === "c");

export const shouldFireFromTouchGesture = ({
  distance,
  durationMs
}: {
  distance: number;
  durationMs: number;
}) => distance <= 12 && durationMs <= 320;

export const resolveCombatPointerAction = ({
  button,
  buttons
}: {
  button: number;
  buttons?: number;
}): CombatPointerAction => {
  if (button === 0) return "fire";
  if (button === 2 || buttons === 2) return "scope";
  return "none";
};
