export type CombatPointerAction = "fire" | "scope" | "none";

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
