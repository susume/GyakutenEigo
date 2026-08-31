export const isServerDeadlineActive = (deadline: string | undefined, nowMs: number) => {
  if (!deadline || !Number.isFinite(nowMs)) return false;
  const deadlineMs = Date.parse(deadline);
  return Number.isFinite(deadlineMs) && nowMs < deadlineMs;
};

export const getAthleticsDashMultiplier = (dashUntil: string | undefined, nowMs: number) =>
  isServerDeadlineActive(dashUntil, nowMs) ? 1.42 : 1;

export const getAthleticsJumpVelocityMultiplier = ({
  jumpBoostUntil,
  chaosJumpHeightCap,
  nowMs
}: {
  jumpBoostUntil?: string;
  chaosJumpHeightCap?: number;
  nowMs: number;
}) => {
  if (isServerDeadlineActive(jumpBoostUntil, nowMs)) return 1.42;
  return chaosJumpHeightCap !== undefined && chaosJumpHeightCap > 4.5 ? 1.26 : 1;
};
