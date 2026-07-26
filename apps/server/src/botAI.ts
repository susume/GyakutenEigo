import type { FlagStateName, GameMode, Team } from "@quizstrike/shared";

export type BotState =
  | "spawn"
  | "regroup"
  | "patrol"
  | "move_to_objective"
  | "defend_objective"
  | "escort_flag_carrier"
  | "attack_flag_carrier"
  | "search"
  | "engage_enemy"
  | "take_cover"
  | "flank"
  | "retreat"
  | "unstuck";

export type BotTacticalRole =
  | "attacker"
  | "defender"
  | "escort"
  | "interceptor"
  | "flanker"
  | "support"
  | "patrol"
  | "overwatch";

export type BotPersonality =
  | "aggressive"
  | "cautious"
  | "objective"
  | "supportive"
  | "flanker"
  | "defender"
  | "explorer";

export interface BotDifficultyProfile {
  reactionMs: number;
  viewDistance: number;
  viewHalfAngle: number;
  memoryMs: number;
  aimErrorRadians: number;
  aimTurnRadians: number;
  thinkIntervalMs: number;
  targetCommitMs: number;
  retreatHealthRatio: number;
  flankChance: number;
  firePauseMs: number;
  objectiveCaptureDelayMs: number;
}

export const BOT_DIFFICULTIES: Record<"beginner" | "standard" | "advanced", BotDifficultyProfile> = {
  beginner: {
    reactionMs: 850,
    viewDistance: 54,
    viewHalfAngle: Math.PI * 0.44,
    memoryMs: 2200,
    aimErrorRadians: 0.2,
    aimTurnRadians: 0.32,
    thinkIntervalMs: 1100,
    targetCommitMs: 1000,
    retreatHealthRatio: 0.2,
    flankChance: 0.12,
    firePauseMs: 700,
    objectiveCaptureDelayMs: 6500
  },
  standard: {
    reactionMs: 500,
    viewDistance: 68,
    viewHalfAngle: Math.PI * 0.36,
    memoryMs: 3800,
    aimErrorRadians: 0.11,
    aimTurnRadians: 0.5,
    thinkIntervalMs: 800,
    targetCommitMs: 1500,
    retreatHealthRatio: 0.3,
    flankChance: 0.28,
    firePauseMs: 520,
    objectiveCaptureDelayMs: 4500
  },
  advanced: {
    reactionMs: 320,
    viewDistance: 86,
    viewHalfAngle: Math.PI * 0.3,
    memoryMs: 5200,
    aimErrorRadians: 0.065,
    aimTurnRadians: 0.7,
    thinkIntervalMs: 650,
    targetCommitMs: 2100,
    retreatHealthRatio: 0.36,
    flankChance: 0.42,
    firePauseMs: 380,
    objectiveCaptureDelayMs: 3000
  }
};

export interface BotMemory {
  lastSeenTargetId?: string;
  lastSeenPosition?: { x: number; z: number };
  lastSeenAtMs?: number;
  visibleTargetId?: string;
  visibleSinceAtMs?: number;
  lastAlertAtMs?: number;
  targetId?: string;
  targetCommitUntilMs: number;
  state: BotState;
  role: BotTacticalRole;
  personality: BotPersonality;
  routeIndex: number;
  nextThinkAtMs: number;
  burstShotsRemaining: number;
  blockedTicks: number;
  noProgressTicks: number;
  lastPosition?: { x: number; z: number };
  navigationGoal?: { x: number; y?: number; z: number };
  navigationPath?: Array<{ x: number; y?: number; z: number }>;
  strafeDirection: -1 | 1;
  seed: number;
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  "aggressive",
  "cautious",
  "objective",
  "supportive",
  "flanker",
  "defender",
  "explorer"
];

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const resolveBotSpacingGoal = ({
  botId,
  botPosition,
  desired,
  teammates,
  minimumDistance = 8
}: {
  botId: string;
  botPosition: { x: number; z: number };
  desired: { x: number; z: number };
  teammates: Array<{ id: string; x?: number; z?: number }>;
  minimumDistance?: number;
}) => {
  let x = desired.x;
  let z = desired.z;
  for (const teammate of teammates) {
    if (teammate.id === botId) continue;
    const teammatePosition = { x: teammate.x ?? 0, z: teammate.z ?? 0 };
    const dx = botPosition.x - teammatePosition.x;
    const dz = botPosition.z - teammatePosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance > minimumDistance) continue;
    const strength = (minimumDistance - distance) / minimumDistance;
    if (distance <= 0.01) {
      const angle = (hashString(botId) % 360) * Math.PI / 180;
      x += Math.cos(angle) * strength * 5;
      z += Math.sin(angle) * strength * 5;
      continue;
    }
    x += (dx / distance) * strength * 5;
    z += (dz / distance) * strength * 5;
  }
  return { x, z };
};

export const shouldAdvanceBotPatrolRoute = ({
  state,
  hasTarget,
  distanceToGoal,
  arrivalDistance = 4
}: {
  state: BotState;
  hasTarget: boolean;
  distanceToGoal: number;
  arrivalDistance?: number;
}) => state === "patrol" && !hasTarget && distanceToGoal <= arrivalDistance;

export const isTargetInsideBotAwareness = ({
  distance,
  inFieldOfView,
  closeAwarenessDistance = 10
}: {
  distance: number;
  inFieldOfView: boolean;
  closeAwarenessDistance?: number;
}) => distance <= closeAwarenessDistance || inFieldOfView;

export const resolveBotPerceptionFocus = ({
  visibleTargetIds,
  currentTargetId,
  visibleSinceAtMs,
  nowMs,
  reactionMs
}: {
  visibleTargetIds: string[];
  currentTargetId?: string;
  visibleSinceAtMs?: number;
  nowMs: number;
  reactionMs: number;
}) => {
  const focusId = currentTargetId && visibleTargetIds.includes(currentTargetId)
    ? currentTargetId
    : visibleTargetIds[0];
  if (!focusId) return { reacted: false as const };
  const acquiredAtMs = focusId === currentTargetId
    ? visibleSinceAtMs ?? nowMs
    : nowMs;
  return {
    focusId,
    visibleSinceAtMs: acquiredAtMs,
    reacted: acquiredAtMs + reactionMs <= nowMs
  };
};

export const createBotMemory = (id: string, index: number, nowMs: number): BotMemory => ({
  state: "spawn",
  role: "patrol",
  personality: BOT_PERSONALITIES[index % BOT_PERSONALITIES.length],
  routeIndex: index % 5,
  nextThinkAtMs: nowMs + (index % 5) * 90,
  targetCommitUntilMs: 0,
  burstShotsRemaining: 1,
  blockedTicks: 0,
  noProgressTicks: 0,
  strafeDirection: index % 2 === 0 ? 1 : -1,
  seed: hashString(`${id}:${index}`)
});

export const nextBotRandom = (memory: BotMemory) => {
  memory.seed = (Math.imul(memory.seed, 1664525) + 1013904223) >>> 0;
  return memory.seed / 0x1_0000_0000;
};

export const randomBetween = (memory: BotMemory, min: number, max: number) =>
  min + (max - min) * nextBotRandom(memory);

export const shouldBotAttemptFlagInteraction = ({
  flagState,
  carrierId,
  botId,
  botPosition,
  flagPosition,
  interactionRadius,
  placedAtMs,
  nowMs,
  captureDelayMs = 0
}: {
  flagState: FlagStateName;
  carrierId?: string;
  botId: string;
  botPosition: { x: number; z: number };
  flagPosition: { x: number; z: number };
  interactionRadius: number;
  placedAtMs?: number;
  nowMs?: number;
  captureDelayMs?: number;
}) => {
  if (flagState === "carried") return carrierId === botId;
  if (
    flagState === "placed"
    && placedAtMs !== undefined
    && nowMs !== undefined
    && nowMs - placedAtMs < captureDelayMs
  ) return false;
  return Math.hypot(botPosition.x - flagPosition.x, botPosition.z - flagPosition.z) <= interactionRadius;
};

const hasFlag = (state: string | undefined, ...values: string[]) => Boolean(state && values.includes(state));

export const chooseBotRole = ({
  gameMode,
  team,
  flagState,
  flagCarrierTeam,
  index,
  teammateCount,
  remainingSeconds,
  personality
}: {
  gameMode: GameMode;
  team: Team;
  flagState?: string;
  flagCarrierTeam?: Team;
  index: number;
  teammateCount: number;
  remainingSeconds: number;
  personality: BotPersonality;
}): BotTacticalRole => {
  if (gameMode === "zombie") return personality === "supportive" ? "support" : "attacker";
  if (gameMode !== "flag") {
    if (personality === "flanker" || index % 5 === 2) return "flanker";
    if (personality === "supportive" || index % 5 === 3) return "support";
    return index % 4 === 0 ? "overwatch" : "attacker";
  }

  const carrierIsOwn = flagCarrierTeam === team;
  const carrierIsEnemy = flagCarrierTeam !== undefined && !carrierIsOwn;
  if (hasFlag(flagState, "carried") && carrierIsOwn) return index % 3 === 0 ? "escort" : "support";
  if (hasFlag(flagState, "carried") && carrierIsEnemy) return index % 3 === 0 ? "interceptor" : "defender";
  if (hasFlag(flagState, "placed", "being_captured")) {
    return team === "red"
      ? index % 3 === 0 ? "overwatch" : "defender"
      : index % 3 === 0 ? "flanker" : "attacker";
  }
  if (team === "red") {
    if (remainingSeconds < 25 && teammateCount > 1) return index % 3 === 0 ? "escort" : "attacker";
    return personality === "defender" || index % 5 === 4 ? "support" : "attacker";
  }
  return personality === "objective" || index % 3 === 0 ? "defender" : "interceptor";
};

export interface BotTargetCandidate {
  id: string;
  distance: number;
  health: number;
  visible: boolean;
  isFlagCarrier: boolean;
  attackingObjective: boolean;
  alliesNearTarget: number;
}

export const scoreBotTarget = ({
  candidate,
  role,
  personality,
  distance,
  weaponRange
}: {
  candidate: BotTargetCandidate;
  role: BotTacticalRole;
  personality: BotPersonality;
  distance: number;
  weaponRange: number;
}) => {
  if (!candidate.visible) return -Infinity;
  let score = 0;
  score += candidate.isFlagCarrier ? 55 : 0;
  score += candidate.attackingObjective ? 32 : 0;
  score += Math.max(0, 22 - distance * 0.35);
  score += Math.max(0, 18 - candidate.health * 0.12);
  score += distance <= weaponRange ? 18 : -18;
  score -= candidate.alliesNearTarget * (personality === "aggressive" ? 2 : 5);
  if (role === "interceptor" && candidate.isFlagCarrier) score += 30;
  if (role === "defender" && candidate.attackingObjective) score += 24;
  if (role === "overwatch") score += distance > weaponRange * 0.45 ? 8 : -8;
  if (role === "flanker") score -= candidate.alliesNearTarget * 2;
  return score;
};

export const chooseBotTarget = ({
  candidates,
  currentTargetId,
  nowMs,
  commitUntilMs,
  role,
  personality,
  weaponRange
}: {
  candidates: BotTargetCandidate[];
  currentTargetId?: string;
  nowMs: number;
  commitUntilMs: number;
  role: BotTacticalRole;
  personality: BotPersonality;
  weaponRange: number;
}) => {
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreBotTarget({ candidate, role, personality, distance: candidate.distance, weaponRange }) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  const current = scored.find((entry) => entry.candidate.id === currentTargetId);
  if (current && nowMs < commitUntilMs && current.score >= scored[0].score - 28) return current.candidate;
  return scored[0]?.candidate;
};

export const resolveBotState = ({
  current,
  health,
  maxHealth,
  targetVisible,
  hasLastKnownTarget,
  objectiveUrgent,
  role,
  personality,
  alliesNearby,
  enemiesVisible,
  flankAvailable,
  randomValue
}: {
  current: BotState;
  health: number;
  maxHealth: number;
  targetVisible: boolean;
  hasLastKnownTarget: boolean;
  objectiveUrgent: boolean;
  role: BotTacticalRole;
  personality: BotPersonality;
  alliesNearby: number;
  enemiesVisible: number;
  flankAvailable: boolean;
  randomValue: number;
}): BotState => {
  const healthRatio = maxHealth > 0 ? health / maxHealth : 1;
  const shouldRetreat = healthRatio <= (personality === "cautious" ? 0.42 : 0.3) && !objectiveUrgent;
  if (shouldRetreat) return "retreat";
  if (current === "unstuck") return "unstuck";
  if (targetVisible) {
    if (shouldRetreat || enemiesVisible > alliesNearby + 1) return "take_cover";
    if (flankAvailable && randomValue < (personality === "flanker" ? 0.6 : 0.22)) return "flank";
    return "engage_enemy";
  }
  if (hasLastKnownTarget) return "search";
  if (role === "defender" || role === "overwatch") return "defend_objective";
  if (role === "escort") return "escort_flag_carrier";
  if (role === "interceptor" || role === "attacker") return objectiveUrgent ? "move_to_objective" : "patrol";
  if (role === "support" && alliesNearby === 0) return "regroup";
  return "patrol";
};

const wrapAngle = (angle: number) => {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
};

export const turnBotToward = (currentFacing: number, desiredFacing: number, maxTurnRadians: number) => {
  const delta = wrapAngle(desiredFacing - currentFacing);
  if (Math.abs(delta) <= maxTurnRadians) return desiredFacing;
  return currentFacing + Math.sign(delta) * maxTurnRadians;
};

export const resolveBotAim = ({
  memory,
  from,
  target,
  currentFacing,
  profile,
  movementPenalty = 0,
  distance,
  nowMs
}: {
  memory: BotMemory;
  from: { x: number; z: number };
  target: { x: number; z: number };
  currentFacing: number;
  profile: BotDifficultyProfile;
  movementPenalty?: number;
  distance: number;
  nowMs: number;
}) => {
  const desired = Math.atan2(from.x - target.x, from.z - target.z);
  const reacquiring = memory.lastSeenTargetId !== memory.targetId || (memory.lastSeenAtMs ?? 0) + profile.reactionMs > nowMs;
  const distancePenalty = Math.min(0.12, distance / 600);
  const error = profile.aimErrorRadians + movementPenalty + distancePenalty + (reacquiring ? 0.04 : 0);
  const signedError = randomBetween(memory, -error, error);
  const aimedFacing = desired + signedError;
  return {
    desiredFacing: aimedFacing,
    facing: turnBotToward(currentFacing, aimedFacing, profile.aimTurnRadians),
    aligned: Math.abs(wrapAngle(aimedFacing - currentFacing)) < 0.42
  };
};

export const getBotWeaponPreference = (weaponId: string) => {
  if (weaponId === "quick_blaster") return { preferredDistance: 20, minimumDistance: 4, burstSize: 3 };
  if (weaponId === "power_blaster") return { preferredDistance: 58, minimumDistance: 18, burstSize: 1 };
  return { preferredDistance: 25, minimumDistance: 7, burstSize: 2 };
};
