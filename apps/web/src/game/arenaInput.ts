import { ATHLETICS_JUMP_HORIZONTAL_SPEED } from "@quizstrike/shared";

export type CombatPointerAction = "fire" | "scope" | "none";

export const PLAYER_FULL_SPEED = ATHLETICS_JUMP_HORIZONTAL_SPEED;
export const PLAYER_CROUCH_SPEED = 6.4;

/** Every game mode has one normal movement speed; Shift changes posture. */
export const resolveMovementSpeed = ({
  crouching,
  hasMovementEnergy,
  gearSpeedMultiplier = 1
}: {
  crouching: boolean;
  hasMovementEnergy: boolean;
  gearSpeedMultiplier?: number;
}) => !hasMovementEnergy
  ? 0
  : (crouching ? PLAYER_CROUCH_SPEED : PLAYER_FULL_SPEED) * gearSpeedMultiplier;

export const resolveCrouching = ({
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
