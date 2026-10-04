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
    description: "Pure parkour racing: answer for energy, climb, descend, and complete the circuit.",
    instructionTitle: "CLIMB THE SKYLINE",
    instructionLines: ["Follow white arrows; gold paths are optional shortcuts", "Answer anytime for energy; falls return you to your last landing", "Descend stage 7; keep running across the start/finish"],
    accent: "#40d9ff"
  },
  zeus: {
    id: "zeus",
    label: "Zeus Mode",
    shortLabel: "Zeus",
    description: "Race to the summit while Zeus chants. Stop when he turns, or lightning sends you back to the start.",
    instructionTitle: "CLIMB TO ZEUS",
    instructionLines: ["Climb while Zeus chants; stop when he turns around", "Move during STOP and lightning sends you to the start", "Answer for energy; first to the summit defeats Zeus"],
    accent: "#b697ff"
  },
  "hunters-runners": {
    id: "hunters-runners",
    label: "Hunters & Runners",
    shortLabel: "Hunters & Runners",
    description: "Runners climb while Hunters defend stations with answer-powered foam balls.",
    instructionTitle: "RUN OR HUNT",
    instructionLines: ["Runners dodge foam balls; CPU Hunters only throw from ahead", "Hunters answer for foam-ball ammo", "Roles swap for the next round"],
    accent: "#ff9c54"
  },
  "chaos-climb": {
    id: "chaos-climb",
    label: "Chaos Climb",
    shortLabel: "Chaos Climb",
    description: "Race through hazard waves with advance warnings, dodge rolling park props, and charge simple abilities.",
    instructionTitle: "SURVIVE THE CHAOS",
    instructionLines: ["Answer for energy; three correct answers charge an ability", "Hazards approach from ahead; amber arrows show their direction", "Sidestep or jump over props; follow the course arrows"],
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
export const HUNTER_PROJECTILE_TRAVEL_MS = 1100;
export const HUNTER_PROJECTILE_COOLDOWN_MS = 1800;
export const HUNTER_PROJECTILE_RADIUS = 0.9;
export const HUNTER_PROJECTILE_RANGE = 96;
export const HUNTER_KNOCKBACK_DISTANCE = 3.2;
export const HUNTER_STAGGER_MS = 280;

/** Camera-facing cone; CPU throws must be visible and on the same storey. */
export const isCpuHunterThreatAhead = (
  origin: AthleticsPointLike,
  runner: AthleticsPointLike & { facing: number }
) => {
  const dx = origin.x - runner.x;
  const dz = origin.z - runner.z;
  const distance = Math.hypot(dx, dz);
  return distance >= 8 && distance <= 48
    && Math.abs(origin.y - runner.y) <= 5
    && (dx * -Math.sin(runner.facing) + dz * -Math.cos(runner.facing)) / distance >= 0.5;
};

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

export type ZeusPhase = "green" | "red" | "idle" | "selecting" | "charging" | "striking" | "rage" | "defeated";
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
  cycleIndex?: number;
  chantId?: import("./zeusDaruma.js").ZeusChantId;
  phaseStartedAt?: string;
  phaseEndsAt?: string;
  graceEndsAt?: string;
  lastStrikes?: { playerId: string; position: AthleticsPointLike; at: string }[];
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
  if (tier === "rage") return { tier, warningDurationMs: 2200, cooldownMs: 5800, targetCount: Math.min(2, count), strikeRadius: 2.4, shockwave: true };
  if (tier === "upper") return { tier, warningDurationMs: 2400, cooldownMs: 6500, targetCount: Math.min(2, count), strikeRadius: 2.2, shockwave: true };
  if (tier === "middle") return { tier, warningDurationMs: 2600, cooldownMs: 7500, targetCount: Math.min(2, count), strikeRadius: 2.05, shockwave: false };
  return { tier, warningDurationMs: 2800, cooldownMs: 9000, targetCount: 1, strikeRadius: 1.95, shockwave: false };
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
  // Both positions are eye-height snapshots. Normal jumps remain inside the
  // strike column, but another storey of the stacked course cannot be hit.
  const verticalDistance = Number.isFinite(targetPosition.y) && Number.isFinite(warningPosition.y)
    ? Math.abs(Number(targetPosition.y) - Number(warningPosition.y)) : 0;
  return { hit: distance <= Math.max(0.5, radius) && verticalDistance <= 5, distance, verticalDistance };
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
  // Mandatory gaps are tuned for standard speed; slowing a racer mid-jump
  // would invalidate that jump contract. Wind changes impacts instead.
  if (type === "wind-gust") return { movementSpeedMultiplier: 1, hazardSpeedMultiplier: 1, jumpHeightCap: 4.5, knockbackMultiplier: 1.15 };
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
export const CHAOS_HAZARD_WARNING_MS = 2200;
export const CHAOS_WAVE_INTERVAL_MS = 8500;
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
    const travel = 0.045 + variance * 0.025;
    // Every prop travels against race progress, including on the descent.
    // Stagger launches in a wave so the whole path never fills at once.
    const startProgress = Math.min(0.94, progress + travel);
    const endProgress = Math.max(0.04, startProgress - travel);
    const durationMs = Math.round((4500 + variance * 1200 + (kind === "giant-ball" ? 600 : 0))
      / (eventType === "speed-round" ? 1.35 : 1));
    const launchDelayMs = index * 900;
    const radius = kind === "giant-ball" ? 1.8 : kind === "runaway-cart" ? 1.2 : kind === "swinging-bumper" ? 1.1 : 0.9;
    wave.push({
      id: `chaos-${Math.max(0, Math.floor(waveIndex))}-${index}-${(hashString(`${seed}:${waveIndex}:${index}`) >>> 0).toString(36)}`,
      kind,
      startProgress,
      endProgress,
      laneOffset: (seededValue(seed, waveIndex * 23 + index + 5) - 0.5) * 3,
      spawnAt: new Date(nowMs + CHAOS_HAZARD_WARNING_MS + launchDelayMs).toISOString(),
      expiresAt: new Date(nowMs + CHAOS_HAZARD_WARNING_MS + launchDelayMs + durationMs).toISOString(),
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
  hazard: Pick<AthleticsHazardDefinition, "startProgress" | "endProgress" | "laneOffset" | "spawnAt" | "expiresAt">
    & Partial<Pick<AthleticsHazardDefinition, "kind" | "radius">>,
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
  const lengths = route.slice(1).map((point, index) => Math.hypot(point.x - route[index]!.x, point.z - route[index]!.z));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const routePosition = (routeProgress: number) => {
    let distance = Math.max(0, Math.min(1, routeProgress)) * totalLength;
    let index = 0;
    while (index < lengths.length - 1 && distance > lengths[index]!) {
      distance -= lengths[index]!;
      index += 1;
    }
    const point = route[index]!;
    const next = route[index + 1] ?? point;
    const part = lengths[index] ? Math.min(1, distance / lengths[index]!) : 0;
    return {
      x: point.x + (next.x - point.x) * part,
      y: point.y + (next.y - point.y) * part,
      z: point.z + (next.z - point.z) * part
    };
  };
  const routeProgress = hazard.startProgress + (hazard.endProgress - hazard.startProgress) * progress;
  const point = routePosition(routeProgress);
  const ahead = routePosition(Math.min(1, routeProgress + 0.003));
  const behind = routePosition(Math.max(0, routeProgress - 0.003));
  const tangentX = ahead.x - behind.x;
  const tangentZ = ahead.z - behind.z;
  const length = Math.hypot(tangentX, tangentZ) || 1;
  return {
    x: point.x - (tangentZ / length) * hazard.laneOffset,
    y: point.y + (hazard.kind === "giant-ball" ? hazard.radius ?? 1.1 : 1.1),
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
  const verticalDistance = Number.isFinite(playerPosition.y) && Number.isFinite(hazardPosition.y)
    ? Math.abs(Number(playerPosition.y) - Number(hazardPosition.y))
    : 0;
  // Player positions use eye height while rolling hazards sit near the floor.
  // Keep a same-platform allowance without letting vertically stacked course
  // sections damage each other merely because their X/Z paths cross.
  const hit = distance <= Math.max(0.5, hazard.radius + 0.8)
    && verticalDistance <= Math.max(1, hazard.radius + 3.4);
  if (!hit) return { hit: false as const, shielded: false, distance, verticalDistance, knockback: 0 };
  if (shieldCharges > 0) return { hit: true as const, shielded: true, distance, verticalDistance, knockback: 0 };
  return {
    hit: true as const,
    shielded: false,
    distance,
    verticalDistance,
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
