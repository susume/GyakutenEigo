import {
  assignHuntersAndRunners,
  ATHLETICS_MODE_CONFIG,
  CHAOS_HAZARD_LIMIT,
  createChaosWave,
  getAthleticsModeSeed,
  getChaosEventForWave,
  getHunterCount,
  getHunterStationProgress,
  HUNTER_KNOCKBACK_DISTANCE,
  HUNTER_MAX_AMMO,
  HUNTER_PROJECTILE_RANGE,
  HUNTER_PROJECTILE_RADIUS,
  HUNTER_PROJECTILE_TRAVEL_MS,
  HUNTER_STAGGER_MS,
  resolveChaosHazardImpact,
  resolveHunterQuizReward,
  resolveRunnerQuizReward,
  resolveZeusStrike,
  selectZeusTargets,
  getZeusAttackProfile,
  type AthleticsAbility,
  type AthleticsChaosState,
  type AthleticsMode,
  type AthleticsRole,
  type AthleticsZeusState,
  type AthleticsHazardDefinition
} from "@quizstrike/shared";

export interface AthleticsModeRoundState {
  mode: AthleticsMode;
  modeSeed: number;
  modeRound: number;
  modeRoundsTotal: number;
  rolesSwapped: boolean;
  roles: Record<string, AthleticsRole>;
  runnerIds: string[];
  hunterIds: string[];
  zeus?: AthleticsZeusState;
  chaos?: AthleticsChaosState;
}

export const getAthleticsMode = (mode: unknown): AthleticsMode =>
  mode === "zeus" || mode === "hunters-runners" || mode === "chaos-climb" ? mode : "classic";

export const createAthleticsModeRoundState = ({
  sessionId,
  playerIds,
  mode,
  round = 1,
  nowMs
}: {
  sessionId: string;
  playerIds: readonly string[];
  mode: unknown;
  round?: number;
  nowMs: number;
}): AthleticsModeRoundState => {
  const resolvedMode = getAthleticsMode(mode);
  const safeRound = Math.max(1, Math.floor(round));
  const roles = resolvedMode === "hunters-runners"
    ? assignHuntersAndRunners(playerIds, safeRound)
    : Object.fromEntries(playerIds.map((playerId) => [playerId, "runner"] as const));
  const runnerIds = playerIds.filter((playerId) => roles[playerId] !== "hunter");
  const hunterIds = playerIds.filter((playerId) => roles[playerId] === "hunter");
  const modeSeed = getAthleticsModeSeed(sessionId, safeRound, resolvedMode);
  const state: AthleticsModeRoundState = {
    mode: resolvedMode,
    modeSeed,
    modeRound: safeRound,
    modeRoundsTotal: resolvedMode === "hunters-runners" ? 2 : 1,
    rolesSwapped: resolvedMode === "hunters-runners" && safeRound > 1,
    roles,
    runnerIds,
    hunterIds
  };
  if (resolvedMode === "zeus") {
    state.zeus = { phase: "idle", attackIndex: 0, recentTargetIds: [] };
  }
  if (resolvedMode === "chaos-climb") {
    state.chaos = {
      seed: modeSeed,
      waveIndex: 0,
      nextWaveAt: new Date(nowMs + 2_800).toISOString(),
      activeHazards: []
    };
  }
  return state;
};

export const getAthleticsModeIntro = (mode: unknown) => {
  const config = ATHLETICS_MODE_CONFIG[getAthleticsMode(mode)];
  return {
    title: config.label.toUpperCase(),
    message: config.instructionTitle,
    detail: config.instructionLines.join(" · ")
  };
};

export const getHunterStation = (stationIndex: number, stationCount: number) => ({
  progress: getHunterStationProgress(stationIndex, stationCount),
  radius: 7
});

export const resolveHunterQuiz = ({ isCorrect, ammo, streak }: { isCorrect: boolean; ammo: number; streak: number }) =>
  resolveHunterQuizReward({ isCorrect, currentAmmo: Math.min(HUNTER_MAX_AMMO, Math.max(0, ammo)), currentStreak: streak });

export const resolveRunnerQuiz = ({ isCorrect, charge, ability }: { isCorrect: boolean; charge: number; ability?: AthleticsAbility }) =>
  resolveRunnerQuizReward({ isCorrect, currentCharge: charge, currentAbility: ability });

export const resolveHunterHitsForRound = ({
  role,
  round,
  previousHits
}: {
  role: AthleticsRole;
  round: number;
  previousHits?: number;
}) => {
  const hits = Number.isFinite(previousHits) ? Math.max(0, Math.floor(previousHits ?? 0)) : 0;
  if (round <= 1) return role === "hunter" ? 0 : undefined;
  return role === "hunter" || hits > 0 ? hits : undefined;
};

export const getZeusTargetPlan = ({
  candidates,
  attackIndex,
  recentTargetIds,
  highestProgress
}: {
  candidates: Parameters<typeof selectZeusTargets>[0]["candidates"];
  attackIndex: number;
  recentTargetIds: readonly string[];
  highestProgress: number;
}) => {
  const profile = getZeusAttackProfile(highestProgress, candidates.length);
  const targets = selectZeusTargets({
    candidates,
    attackIndex,
    targetCount: profile.targetCount,
    recentTargetIds
  });
  return { profile, targets };
};

export const resolveZeusHit = resolveZeusStrike;

export const createAuthoritativeChaosWave = ({
  seed,
  waveIndex,
  nowMs,
  activeHazardCount,
  playerCount
}: Parameters<typeof createChaosWave>[0]) => {
  const event = getChaosEventForWave({ seed, waveIndex, nowMs });
  return {
    hazards: createChaosWave({ seed, waveIndex, nowMs, activeHazardCount, playerCount, eventType: event?.type }),
    event
  };
};

export const resolveChaosHit = resolveChaosHazardImpact;

export const athleticsModeLimits = {
  chaosHazards: CHAOS_HAZARD_LIMIT,
  hunterProjectileTravelMs: HUNTER_PROJECTILE_TRAVEL_MS,
  hunterProjectileRange: HUNTER_PROJECTILE_RANGE,
  hunterProjectileRadius: HUNTER_PROJECTILE_RADIUS,
  hunterKnockbackDistance: HUNTER_KNOCKBACK_DISTANCE,
  hunterStaggerMs: HUNTER_STAGGER_MS,
  hunterCount: getHunterCount
} as const;

export type PendingHunterProjectile = {
  id: string;
  sessionId: string;
  hunterId: string;
  targetId: string;
  origin: { x: number; y: number; z: number };
  targetAtLaunch: { x: number; y: number; z: number };
  launchedAt: number;
  impactAt: number;
  radius: number;
  resolved?: boolean;
};

export const isActiveChaosHazard = (hazard: AthleticsHazardDefinition, nowMs: number) => {
  const spawnAt = Date.parse(hazard.spawnAt);
  const expiresAt = Date.parse(hazard.expiresAt);
  return Number.isFinite(spawnAt) && Number.isFinite(expiresAt) && nowMs >= spawnAt && nowMs <= expiresAt;
};
