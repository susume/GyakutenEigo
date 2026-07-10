export type IncomingHitDirection = "front" | "right" | "back" | "left" | "center";

type ArenaPoint = {
  x: number;
  z: number;
};

type FacingPoint = ArenaPoint & {
  facing: number;
};

const normalizeRadians = (value: number) => {
  let angle = value;
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
};

const isFinitePoint = (point: ArenaPoint) => Number.isFinite(point.x) && Number.isFinite(point.z);

export const getIncomingHitDirection = ({
  attacker,
  target
}: {
  attacker: ArenaPoint;
  target: FacingPoint;
}): IncomingHitDirection => {
  if (!isFinitePoint(attacker) || !isFinitePoint(target) || !Number.isFinite(target.facing)) return "center";

  const dx = attacker.x - target.x;
  const dz = attacker.z - target.z;
  if (Math.hypot(dx, dz) < 0.001) return "center";

  const relativeAngle = normalizeRadians(Math.atan2(dx, dz) - target.facing);
  const absRelativeAngle = Math.abs(relativeAngle);
  const diagonalCutoff = Math.PI / 4;

  if (absRelativeAngle <= diagonalCutoff) return "front";
  if (absRelativeAngle >= Math.PI - diagonalCutoff) return "back";
  return relativeAngle > 0 ? "right" : "left";
};

export const shouldAutoOpenRespawnPractice = ({
  wasAlive,
  isAlive,
  canPractice
}: {
  wasAlive: boolean | null;
  isAlive: boolean;
  canPractice: boolean;
}) => wasAlive === true && !isAlive && canPractice;
