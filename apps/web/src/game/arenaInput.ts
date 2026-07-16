export type CombatPointerAction = "fire" | "scope" | "none";

export const isFireKeyboardEvent = ({ code, key }: { code: string; key: string }) =>
  code === "KeyF" || key.toLowerCase() === "f";

export const isScopeKeyboardEvent = ({ code, key }: { code: string; key: string }) =>
  code === "KeyC" || key.toLowerCase() === "c";

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
