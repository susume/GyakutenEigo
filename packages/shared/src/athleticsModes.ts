/**
 * Shared rules for the Athletics variants.
 *
 * This module deliberately contains deterministic, serializable decisions.
 * The server calls these helpers to authoritatively mutate a session and the
 * client uses the same helpers only to present a predicted path or HUD.
 */

export type AthleticsMode = "classic" | "zeus" | "hunters-runners" | "chaos-climb";
export type AthleticsRole = "runner" | "hunter";
export type AthleticsAbility = "dash" | "shield" | "super-jump" | "anchor";

export interface AthleticsModeConfig {
  id: AthleticsMode;
  label: string;
  shortLabel: string;
  description: string;
  instructionTitle: string;
  instructionLines: readonly string[];
  accent: string;
}

export const ATHLETICS_MODES = ["classic", "zeus", "hunters-runners", "chaos-climb"] as const satisfies readonly AthleticsMode[];

export const ATHLETICS_MODE_CONFIG: Readonly<Record<AthleticsMode, AthleticsModeConfig>> = {
  classic: {
    id: "classic",
    label: "Classic Athletics",
    shortLabel: "Classic",
    description: "Pure parkour racing: answer for energy, jump the course, and reach the summit.",
    instructionTitle: "CLIMB THE SKYLINE",
    instructionLines: ["Answer for movement energy", "Jump from platform to platform", "Reach the summit first"],
    accent: "#40d9ff"
  },
  zeus: {
    id: "zeus",
    label: "Zeus Mode",
    shortLabel: "Zeus",
    description: "Climb toward Zeus, dodge telegraphed lightning, and answer to break an electric freeze.",
    instructionTitle: "CLIMB TO ZEUS",
    instructionLines: ["Dodge the warning ring", "Answer correctly to break a freeze", "First to the summit defeats Zeus"],
    accent: "#b697ff"
  },
  "hunters-runners": {
    id: "hunters-runners",
    label: "Hunters & Runners",
    shortLabel: "Hunters & Runners",
    description: "Runners climb while Hunters defend stations with answer-powered foam balls.",
    instructionTitle: "RUN OR HUNT",
    instructionLines: ["Runners climb to the summit", "Hunters answer for foam-ball ammo", "Roles swap for the next round"],
    accent: "#ff9c54"
  },
  "chaos-climb": {
    id: "chaos-climb",
    label: "Chaos Climb",
    shortLabel: "Chaos Climb",
    description: "Race through seeded hazard waves, dodge rolling park props, and charge simple abilities.",
    instructionTitle: "SURVIVE THE CHAOS",
    instructionLines: ["Answer for energy and abilities", "Watch for rolling hazards", "Recover at the last safe checkpoint"],
    accent: "#ff7fb4"
  }
};

export const sanitizeAthleticsMode = (value: unknown): AthleticsMode =>
  typeof value === "string" && (ATHLETICS_MODES as readonly string[]).includes(value)
    ? value as AthleticsMode
    : "classic";

export const getAthleticsModeConfig = (mode: unknown) => ATHLETICS_MODE_CONFIG[sanitizeAthleticsMode(mode)];

const hashString = (value: string) => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

export const getAthleticsModeSeed = (sessionId: string, round: number, mode: AthleticsMode = "classic") =>
  hashString(`${sessionId}:${mode}:${Math.max(1, Math.floor(round))}`);

export const getHunterCount = (playerCount: number) => {
  const count = Math.max(0, Math.floor(playerCount));
  if (count < 2) return 0;
  // The classroom-sized examples become 3/1, 7/3, and 22/8. Keep one runner
  // available even for tiny rooms so the mode remains playable.
  return Math.max(1, Math.min(count - 1, Math.round(count * 0.25)));
};

export const assignHuntersAndRunners = (playerIds: readonly string[], round = 1) => {
  const uniqueIds = [...new Set(playerIds.filter((id) => typeof id === "string" && id.length > 0))];
  const hunterCount = getHunterCount(uniqueIds.length);
  const orderForRound = (roundNumber: number) => uniqueIds.slice().sort((left, right) => {
    const leftHash = hashString(`${roundNumber}:${left}`);
    const rightHash = hashString(`${roundNumber}:${right}`);
    return leftHash - rightHash || left.localeCompare(right);
  });
  const ordered = orderForRound(round);
  const firstRoundHunters = new Set(orderForRound(1).slice(0, hunterCount));
  // Keep the hunter share balanced while ensuring every first-round Hunter
  // changes role for the second round. This is deterministic and gives the
  // classroom a visible role swap without turning round two into a 75% hunter
  // lobby just because the first round had a small defender group.
  const hunterCandidates = round > 1
    ? ordered.filter((id) => !firstRoundHunters.has(id))
    : ordered;
  const hunters = new Set(hunterCandidates.slice(0, hunterCount));
  return Object.fromEntries(uniqueIds.map((id) => [id, hunters.has(id) ? "hunter" : "runner"] as const)) as Record<string, AthleticsRole>;
};

export const getHunterStationProgress = (stationIndex: number, stationCount: number) => {
  const count = Math.max(1, Math.floor(stationCount));
  const index = Math.max(0, Math.min(count - 1, Math.floor(stationIndex)));
  // Stations intentionally cover the course but never occupy the final pad.
  return Math.min(0.78, Math.max(0.18, 0.18 + (index / Math.max(1, count - 1)) * 0.58));
};

export const HUNTER_START_AMMO = 0;
export const HUNTER_CORRECT_AMMO = 3;
export const HUNTER_STREAK_BONUS_AMMO = 2;
export const HUNTER_MAX_AMMO = 12;
export const HUNTER_PROJECTILE_TRAVEL_MS = 520;
export const HUNTER_PROJECTILE_COOLDOWN_MS = 850;
export const HUNTER_PROJECTILE_RADIUS = 1.3;
export const HUNTER_PROJECTILE_RANGE = 96;
export const HUNTER_KNOCKBACK_DISTANCE = 3.2;
export const HUNTER_STAGGER_MS = 280;

export interface HunterQuizReward {
  ammo: number;
  streak: number;
  bonusAmmo: number;
}

export const resolveHunterQuizReward = ({
  isCorrect,
  currentAmmo,
  currentStreak
}: {
  isCorrect: boolean;
  currentAmmo: number;
  currentStreak: number;
}): HunterQuizReward => {
  const streak = isCorrect ? Math.max(0, Math.floor(currentStreak)) + 1 : 0;
  const bonusAmmo = isCorrect && streak > 0 && streak % 3 === 0 ? HUNTER_STREAK_BONUS_AMMO : 0;
  return {
    ammo: Math.min(HUNTER_MAX_AMMO, Math.max(0, Math.floor(currentAmmo)) + (isCorrect ? HUNTER_CORRECT_AMMO + bonusAmmo : 0)),
    streak,
    bonusAmmo
  };
};

export const RUNNER_ABILITY_METER_MAX = 3;
export const RUNNER_ABILITY_SEQUENCE: readonly AthleticsAbility[] = ["shield", "dash", "super-jump", "anchor"];

export const resolveRunnerQuizReward = ({
  isCorrect,
  currentCharge,
  currentAbility
}: {
  isCorrect: boolean;
  currentCharge: number;
  currentAbility?: AthleticsAbility;
}) => {
  const charge = isCorrect
    ? Math.min(RUNNER_ABILITY_METER_MAX, Math.max(0, Math.floor(currentCharge)) + 1)
    : Math.max(0, Math.floor(currentCharge));
  const abilityReady = charge >= RUNNER_ABILITY_METER_MAX
    ? currentAbility ?? RUNNER_ABILITY_SEQUENCE[0]
    : currentAbility;
  return { charge, abilityReady };
};

export const consumeRunnerAbility = ({
  ability,
  charge
}: {
  ability?: AthleticsAbility;
  charge: number;
}) => {
  if (!ability || charge < RUNNER_ABILITY_METER_MAX) return { ok: false as const, charge: Math.max(0, Math.floor(charge)) };
  const currentIndex = RUNNER_ABILITY_SEQUENCE.indexOf(ability);
  const nextAbility = RUNNER_ABILITY_SEQUENCE[(currentIndex + 1) % RUNNER_ABILITY_SEQUENCE.length];
  return {
    ok: true as const,
    charge: 0,
    ability: nextAbility
  };
};

export type ZeusPhase = "idle" | "selecting" | "charging" | "striking" | "rage" | "defeated";
export type ZeusAttackTier = "lower" | "middle" | "upper" | "rage";

export interface AthleticsZeusAttack {
  id: string;
  tier: ZeusAttackTier;
  targetIds: string[];
  warningPositions: Record<string, AthleticsPointLike>;
  warningStartedAt: string;
  strikeAt: string;
  strikeRadius: number;
  shockwave: boolean;
}

export interface AthleticsZeusState {
  phase: ZeusPhase;
  attackIndex: number;
  nextAttackAt?: string;
  recentTargetIds: string[];
  currentAttack?: AthleticsZeusAttack;
}

export interface ZeusAttackProfile {
  tier: ZeusAttackTier;
  warningDurationMs: number;
  cooldownMs: number;
  targetCount: number;
  strikeRadius: number;
  shockwave: boolean;
}

export const getZeusAttackTier = (highestProgress: number): ZeusAttackTier => {
  const progress = Math.max(0, Math.min(1, Number.isFinite(highestProgress) ? highestProgress : 0));
  if (progress >= 0.82) return "rage";
  if (progress >= 0.58) return "upper";
  if (progress >= 0.28) return "middle";
  return "lower";
};

export const getZeusAttackProfile = (highestProgress: number, playerCount: number): ZeusAttackProfile => {
  const tier = getZeusAttackTier(highestProgress);
  const count = Math.max(1, Math.floor(playerCount));
  if (tier === "rage") return { tier, warningDurationMs: 1050, cooldownMs: 3000, targetCount: Math.min(2, count), strikeRadius: 3.4, shockwave: true };
  if (tier === "upper") return { tier, warningDurationMs: 1250, cooldownMs: 4700, targetCount: Math.min(2, count), strikeRadius: 2.8, shockwave: true };
  if (tier === "middle") return { tier, warningDurationMs: 1500, cooldownMs: 6100, targetCount: Math.min(2, count), strikeRadius: 2.35, shockwave: false };
  return { tier, warningDurationMs: 1800, cooldownMs: 7800, targetCount: 1, strikeRadius: 1.95, shockwave: false };
};

export interface ZeusTargetCandidate {
  id: string;
  routeProgress: number;
  x: number;
  y: number;
  z: number;
  eligible?: boolean;
}

export const selectZeusTargets = ({
  candidates,
  attackIndex,
  targetCount,
  recentTargetIds = []
}: {
  candidates: readonly ZeusTargetCandidate[];
  attackIndex: number;
  targetCount: number;
  recentTargetIds?: readonly string[];
}) => {
  const eligible = candidates.filter((candidate) => candidate.eligible !== false);
  const recent = new Set(recentTargetIds);
  const sorted = eligible.slice().sort((left, right) => {
    const leftScore = hashString(`${attackIndex}:${left.id}`) + (recent.has(left.id) ? 0x1_0000_0000 : 0);
    const rightScore = hashString(`${attackIndex}:${right.id}`) + (recent.has(right.id) ? 0x1_0000_0000 : 0);
    return leftScore - rightScore || left.id.localeCompare(right.id);
  });
  return sorted.slice(0, Math.max(0, Math.floor(targetCount)));
};

export const resolveZeusStrike = ({
  targetPosition,
  warningPosition,
  radius
}: {
  targetPosition: { x: number; y?: number; z: number };
  warningPosition: { x: number; y?: number; z: number };
  radius: number;
}) => {
  const distance = Math.hypot(targetPosition.x - warningPosition.x, targetPosition.z - warningPosition.z);
  return { hit: distance <= Math.max(0.5, radius), distance };
};

export const ZEUS_FREEZE_CORRECT_RELEASE_MS = 0;
export const ZEUS_FREEZE_WRONG_EXTENSION_MS = 1200;

export const resolveZeusAnswer = ({ isCorrect, nowMs }: { isCorrect: boolean; nowMs: number }) => ({
  released: isCorrect,
  frozen: !isCorrect,
  freezeUntil: new Date(nowMs + (isCorrect ? ZEUS_FREEZE_CORRECT_RELEASE_MS : ZEUS_FREEZE_WRONG_EXTENSION_MS)).toISOString()
});

export interface AthleticsPointLike {
  x: number;
  y: number;
  z: number;
}

export type ChaosHazardKind = "giant-ball" | "barrel" | "rubber-duck" | "runaway-cart" | "swinging-bumper";
export type ChaosEventType = "giant-ball" | "object-stampede" | "wind-gust" | "low-gravity" | "speed-round";

export interface AthleticsHazardDefinition {
  id: string;
  kind: ChaosHazardKind;
  startProgress: number;
  endProgress: number;
  laneOffset: number;
  spawnAt: string;
  expiresAt: string;
  speed: number;
  radius: number;
  knockback: number;
  hitIds?: string[];
}

export interface AthleticsChaosEvent {
  id: string;
  type: ChaosEventType;
  label: string;
  startedAt: string;
  expiresAt: string;
}

export interface AthleticsChaosEventModifiers {
  /** Server movement multiplier during the event. */
  movementSpeedMultiplier: number;
  /** Multiplier used by the shared timestamped hazard path. */
  hazardSpeedMultiplier: number;
  /** Maximum vertical travel above the current landing while jumping. */
  jumpHeightCap: number;
  /** Multiplier applied to unshielded hazard knockback. */
  knockbackMultiplier: number;
}

export const getChaosEventModifiers = (
  event?: Pick<AthleticsChaosEvent, "type"> | ChaosEventType
): AthleticsChaosEventModifiers => {
  const type = typeof event === "string" ? event : event?.type;
  if (type === "speed-round") return { movementSpeedMultiplier: 1, hazardSpeedMultiplier: 1.35, jumpHeightCap: 4.5, knockbackMultiplier: 1 };
  if (type === "low-gravity") return { movementSpeedMultiplier: 1, hazardSpeedMultiplier: 1, jumpHeightCap: 7.2, knockbackMultiplier: 1 };
  if (type === "wind-gust") return { movementSpeedMultiplier: 0.9, hazardSpeedMultiplier: 1, jumpHeightCap: 4.5, knockbackMultiplier: 1.15 };
  return { movementSpeedMultiplier: 1, hazardSpeedMultiplier: 1, jumpHeightCap: 4.5, knockbackMultiplier: 1 };
};

export interface AthleticsChaosState {
  seed: number;
  waveIndex: number;
  nextWaveAt: string;
  activeHazards: AthleticsHazardDefinition[];
  currentEvent?: AthleticsChaosEvent;
}

export const CHAOS_HAZARD_LIMIT = 18;
export const CHAOS_WAVE_INTERVAL_MS = 5200;
export const CHAOS_EVENT_DURATION_MS = 7000;
export const CHAOS_EVENT_INTERVAL = 4;

const chaosKinds: readonly ChaosHazardKind[] = ["giant-ball", "barrel", "rubber-duck", "runaway-cart", "swinging-bumper"];
const chaosEvents: readonly ChaosEventType[] = ["giant-ball", "object-stampede", "wind-gust", "low-gravity", "speed-round"];
const chaosEventLabels: Record<ChaosEventType, string> = {
  "giant-ball": "GIANT BALL",
  "object-stampede": "OBJECT STAMPEDE",
  "wind-gust": "WIND GUST",
  "low-gravity": "LOW GRAVITY",
  "speed-round": "SPEED ROUND"
};

const seededValue = (seed: number, index: number) => (hashString(`${seed}:${index}`) % 10_000) / 10_000;

export const createChaosWave = ({
  seed,
  waveIndex,
  nowMs,
  activeHazardCount = 0,
  playerCount = 1,
  eventType
}: {
  seed: number;
  waveIndex: number;
  nowMs: number;
  activeHazardCount?: number;
  playerCount?: number;
  eventType?: ChaosEventType;
}) => {
  const available = Math.max(0, CHAOS_HAZARD_LIMIT - Math.floor(activeHazardCount));
  const progress = Math.min(0.88, 0.08 + ((waveIndex * 0.137) % 0.72));
  const baseCount = Math.min(3, Math.ceil(Math.max(1, playerCount) / 10)) + (waveIndex >= 3 ? 1 : 0);
  const desiredCount = Math.min(
    available,
    eventType === "object-stampede" ? Math.max(2, baseCount + 1) : Math.max(1, baseCount)
  );
  const wave: AthleticsHazardDefinition[] = [];
  for (let index = 0; index < desiredCount; index += 1) {
    const variance = seededValue(seed, waveIndex * 11 + index);
    const kind = eventType === "giant-ball" && index === 0
      ? "giant-ball"
      : chaosKinds[Math.floor(seededValue(seed, waveIndex * 17 + index + 3) * chaosKinds.length)] ?? "barrel";
    const downhill = (waveIndex + index) % 2 === 0;
    const startProgress = downhill ? Math.min(0.94, progress + 0.12 + variance * 0.08) : Math.max(0.04, progress - variance * 0.05);
    const endProgress = downhill ? Math.max(0.04, startProgress - (0.12 + variance * 0.09)) : Math.min(0.94, startProgress + (0.12 + variance * 0.09));
    const durationMs = Math.round(2500 + variance * 1000 + (kind === "giant-ball" ? 600 : 0));
    const radius = kind === "giant-ball" ? 3.1 : kind === "runaway-cart" ? 2.3 : kind === "swinging-bumper" ? 2 : 1.45;
    wave.push({
      id: `chaos-${Math.max(0, Math.floor(waveIndex))}-${index}-${(hashString(`${seed}:${waveIndex}:${index}`) >>> 0).toString(36)}`,
      kind,
      startProgress,
      endProgress,
      laneOffset: (seededValue(seed, waveIndex * 23 + index + 5) - 0.5) * 8,
      spawnAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + durationMs).toISOString(),
      speed: 1 / durationMs,
      radius,
      knockback: kind === "giant-ball" ? 5.2 : kind === "runaway-cart" ? 4.2 : kind === "swinging-bumper" ? 3.6 : 2.6,
      hitIds: []
    });
  }
  return wave;
};

export const getChaosEventForWave = ({ seed, waveIndex, nowMs }: { seed: number; waveIndex: number; nowMs: number }) => {
  if (waveIndex <= 0 || waveIndex % CHAOS_EVENT_INTERVAL !== 0) return undefined;
  const type = chaosEvents[hashString(`${seed}:event:${waveIndex}`) % chaosEvents.length] ?? "object-stampede";
  return {
    id: `chaos-event-${waveIndex}-${(hashString(`${seed}:${type}`) >>> 0).toString(36)}`,
    type,
    label: chaosEventLabels[type],
    startedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + CHAOS_EVENT_DURATION_MS).toISOString()
  } satisfies AthleticsChaosEvent;
};

export const getChaosHazardPosition = (
  hazard: Pick<AthleticsHazardDefinition, "startProgress" | "endProgress" | "laneOffset" | "spawnAt" | "expiresAt">,
  route: readonly AthleticsPointLike[],
  nowMs: number,
  speedMultiplier = 1
) => {
  const startAt = Date.parse(hazard.spawnAt);
  const endAt = Date.parse(hazard.expiresAt);
  const rawProgress = !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt
    ? 0
    : (nowMs - startAt) / (endAt - startAt);
  const progress = Math.max(0, Math.min(1, rawProgress * Math.max(0.1, speedMultiplier)));
  const routePosition = (routeProgress: number) => {
    const safeProgress = Math.max(0, Math.min(1, routeProgress));
    const exact = safeProgress * Math.max(1, route.length - 1);
    const index = Math.min(route.length - 1, Math.floor(exact));
    const next = route[Math.min(route.length - 1, index + 1)] ?? route[index]!;
    const point = route[index]!;
    const part = exact - index;
    return {
      x: point.x + (next.x - point.x) * part,
      y: point.y + (next.y - point.y) * part,
      z: point.z + (next.z - point.z) * part
    };
  };
  const point = routePosition(hazard.startProgress + (hazard.endProgress - hazard.startProgress) * progress);
  const ahead = routePosition(Math.min(1, Math.max(0, hazard.startProgress + (hazard.endProgress - hazard.startProgress) * progress + 0.003)));
  const tangentX = ahead.x - point.x;
  const tangentZ = ahead.z - point.z;
  const length = Math.hypot(tangentX, tangentZ) || 1;
  return {
    x: point.x - (tangentZ / length) * hazard.laneOffset,
    y: point.y + 1.1,
    z: point.z + (tangentX / length) * hazard.laneOffset,
    progress
  };
};

export const resolveChaosHazardImpact = ({
  hazard,
  playerPosition,
  hazardPosition,
  shieldCharges = 0
}: {
  hazard: Pick<AthleticsHazardDefinition, "radius" | "knockback">;
  playerPosition: { x: number; y?: number; z: number };
  hazardPosition: { x: number; y?: number; z: number };
  shieldCharges?: number;
}) => {
  const distance = Math.hypot(playerPosition.x - hazardPosition.x, playerPosition.z - hazardPosition.z);
  const hit = distance <= Math.max(0.5, hazard.radius + 0.8);
  if (!hit) return { hit: false as const, shielded: false, distance, knockback: 0 };
  if (shieldCharges > 0) return { hit: true as const, shielded: true, distance, knockback: 0 };
  return {
    hit: true as const,
    shielded: false,
    distance,
    knockback: Math.max(1.5, Math.min(6, hazard.knockback)),
    staggerMs: 300
  };
};

export const getChaosAbilityLabel = (ability?: AthleticsAbility) => {
  if (ability === "dash") return "DASH";
  if (ability === "shield") return "SHIELD";
  if (ability === "super-jump") return "SUPER JUMP";
  if (ability === "anchor") return "ANCHOR";
  return "Charging";
};
