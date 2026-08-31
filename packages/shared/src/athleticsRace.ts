import type { ArenaPosition, PlayerSession } from "./index.js";
import type {
  AthleticsAbility,
  AthleticsChaosState,
  AthleticsMode,
  AthleticsRole,
  AthleticsZeusState
} from "./athleticsModes.js";

export type AthleticsCourseId = "stadium_loop";

export type AthleticsRaceStatus = "countdown" | "running" | "finished" | "expired";
export type AthleticsPlayerStatus = "racing" | "finished" | "dnf";

/** Physical support categories used by the server-owned fall classifier. */
export type AthleticsPhysicalSupportKind =
  | "main_surface"
  | "shortcut_surface"
  | "moving_platform"
  | "park_floor"
  | "airborne";

/** Stable reason codes make fall decisions inspectable in development/tests. */
export type AthleticsRecoveryReason =
  | "below_world"
  | "park_floor"
  | "outside_route_bounds"
  | "below_recoverable_height";

export interface AthleticsRaceState {
  courseId: AthleticsCourseId;
  /** Additive variant selector. Missing legacy values are Classic Athletics. */
  mode?: AthleticsMode;
  /** Seed and phase data are server-owned; clients use them to render paths. */
  modeSeed?: number;
  modeRound?: number;
  /** Number of question credits available on every lap. Questions are fuel, not gates. */
  questionsPerLap: number;
  /** Total correct answers that can be earned from the configured question pool. */
  questionCount: number;
  requiredLaps: number;
  status: AthleticsRaceStatus;
  /** Official GO timestamp. Before this instant the course is locked. */
  startAt: string;
  finishOrder: string[];
  /** Zeus telegraphs and Chaos waves are included in snapshots for interpolation. */
  zeus?: AthleticsZeusState;
  chaos?: AthleticsChaosState;
  /** Hunters & Runners keeps the role assignment visible to the teacher/report. */
  runnerIds?: string[];
  hunterIds?: string[];
  modeRoundsTotal?: number;
  rolesSwapped?: boolean;
}

export interface AthleticsPlayerState {
  /** Number of race questions answered correctly. */
  questionIndex: number;
  /** Number of safe course checkpoints reached on the current lap. */
  checkpointIndex: number;
  /** Monotonic validated route progress within the current lap. */
  routeProgress: number;
  /** Kept for wire compatibility with the earlier gate-based build. It now means a question is available. */
  gateOpen: boolean;
  falls: number;
  lastSafeCheckpointIndex: number;
  /** Last stable main-route landing accepted by the server. */
  lastSafeSurfaceIndex?: number;
  /** Current physical support; this is intentionally separate from routeProgress. */
  currentSupportedSurfaceIndex?: number;
  currentSupportKind?: AthleticsPhysicalSupportKind;
  /** Server timestamps are diagnostic/transient and are not used as route progress. */
  lastSupportedAtMs?: number;
  /** True while the racer is frozen in the three-correct recovery challenge. */
  recoveryActive?: boolean;
  recoveryCorrectAnswers?: number;
  recoveryRequiredAnswers?: number;
  recoverySurfaceId?: string;
  recoveryRouteProgress?: number;
  recoveryReason?: AthleticsRecoveryReason;
  /** Incremented whenever recovery invalidates in-flight movement packets. */
  movementEpoch?: number;
  lastAcceptedMovementSequence?: number;
  /** Short guard that protects the exact respawn from queued pre-recovery packets. */
  recoverySettleUntil?: string;
  checkpointSplitsMs: number[];
  completedLaps: number;
  lapSplitsMs: number[];
  /** Short server-owned reset window between individual racers' laps. */
  lapTransitionUntil?: string;
  respawnPenaltyUntil?: string;
  laneIndex?: number;
  status: AthleticsPlayerStatus;
  finishPosition?: number;
  finishTimeMs?: number;
  finishedAt?: string;
  wrongAnswerPenaltyUntil?: string;
  /** Mode-specific state is intentionally colocated with race progress so a
   * single player_state snapshot can restore a reconnecting tablet. */
  role?: AthleticsRole;
  stationIndex?: number;
  hunterAmmo?: number;
  hunterHits?: number;
  hunterQuizStreak?: number;
  abilityCharge?: number;
  abilityReady?: AthleticsAbility;
  shieldCharges?: number;
  dashUntil?: string;
  jumpBoostUntil?: string;
  knockbackResistUntil?: string;
  staggerUntil?: string;
  zeusFrozen?: boolean;
  zeusFrozenUntil?: string;
  lastChaosHazardId?: string;
}

export type AthleticsAccent = "cyan" | "orange" | "lime" | "violet" | "pink" | "gold";

export interface AthleticsRoutePoint extends Pick<ArenaPosition, "x" | "z"> {
  /** Walkable ground height in world units. */
  y: number;
}

export interface AthleticsCourseSection {
  id: string;
  label: string;
  description: string;
  startProgress: number;
  endProgress: number;
  accent: AthleticsAccent;
  landmark: string;
}

/** Authored vocabulary for the way a player moves between two landings. */
export type AthleticsTransitionType =
  | "jump"
  | "easy_jump"
  | "hard_jump"
  | "shortcut_jump"
  | "connected"
  | "checkpoint_entry"
  | "moving_jump"
  | "elevator"
  | "bridge"
  | "attraction";

export interface AthleticsCourseTransition {
  id: string;
  fromSurfaceId: string;
  toSurfaceId: string;
  type: AthleticsTransitionType;
  /** Optional note for level review and future route tooling. */
  note?: string;
  movingObstacleId?: string;
}

export type AthleticsSurfaceKind = "platform" | "ramp" | "stair" | "checkpoint";

/** Authored walkable surface used by both the scene and authoritative collision. */
export interface AthleticsCourseSurface {
  id: string;
  kind: AthleticsSurfaceKind;
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  rotationY?: number;
  /** A little extra room is reserved around safe recovery platforms. */
  safe?: boolean;
  material?: "wood" | "metal" | "stone" | "accent" | "cloth";
}

/** Optional authored branch that rejoins the main line later. */
export interface AthleticsCourseShortcut {
  id: string;
  label: string;
  startProgress: number;
  endProgress: number;
  route: readonly AthleticsRoutePoint[];
  surfaces: readonly AthleticsCourseSurface[];
  transitions: readonly AthleticsCourseTransition[];
  routeWidth?: number;
}

export type AthleticsMovingAxis = "x" | "y" | "z";

export interface AthleticsMovingObstacle {
  id: string;
  kind: "platform" | "elevator" | "barrier";
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  axis: AthleticsMovingAxis;
  amplitude: number;
  periodMs: number;
  phaseMs?: number;
  material?: "wood" | "metal" | "accent";
  jumpable?: boolean;
}

export interface AthleticsCourseDefinition {
  id: AthleticsCourseId;
  title: string;
  subtitle: string;
  route: readonly AthleticsRoutePoint[];
  sections: readonly AthleticsCourseSection[];
  checkpoints: readonly number[];
  surfaces: readonly AthleticsCourseSurface[];
  transitions: readonly AthleticsCourseTransition[];
  shortcuts: readonly AthleticsCourseShortcut[];
  movingObstacles: readonly AthleticsMovingObstacle[];
  routeWidth: number;
  finishThreshold: number;
  bounds: { limitX: number; limitZ: number };
}

/** Compact vertical footprint: the playable course stays inside a 280 x 280 park. */
export const ATHLETICS_COURSE_BOUNDS = { limitX: 140, limitZ: 140 } as const;
export const ATHLETICS_PLAYER_EYE_HEIGHT = 4.21;
export const ATHLETICS_CHECKPOINT_COUNT = 6;
export const ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT = 0.55;
export const ATHLETICS_SURFACE_SLAB_HEIGHT = 1.1;
/** Falls farther below the authored lane than a normal jump can recover from. */
export const ATHLETICS_MAX_RECOVERABLE_ROUTE_DROP = 1.75;

/**
 * Athletics uses its own movement economy while sharing the same safe,
 * server-owned answer validation and question history with Zombie Mode.
 */
export const ATHLETICS_MAX_ENERGY = 1000;
export const ATHLETICS_CORRECT_ENERGY = 220;
/** Athletics has one normal movement speed. */
export const ATHLETICS_MOVEMENT_DRAIN_PER_SECOND = 6.4;
export const ATHLETICS_JUMP_ENERGY_COST = 30;
export const ATHLETICS_CRITICAL_ENERGY = 150;
export const ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED = 3;
/** A completed recovery always leaves enough fuel for one immediate retry. */
export const ATHLETICS_RECOVERY_MIN_ENERGY = ATHLETICS_CORRECT_ENERGY;
/** Keep queued fall packets from immediately undoing an exact recovery respawn. */
export const ATHLETICS_RECOVERY_SETTLE_MS = 400;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const safeNumber = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const segmentLength = (start: Pick<ArenaPosition, "x" | "z">, end: Pick<ArenaPosition, "x" | "z">) =>
  Math.hypot(end.x - start.x, end.z - start.z);

const routeLengths = (course: Pick<AthleticsCourseDefinition, "route">) => {
  const lengths = course.route.slice(1).map((point, index) => segmentLength(course.route[index]!, point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { lengths, total: total || 1 };
};

const routeProgressAtIndex = (route: readonly AthleticsRoutePoint[], index: number) => {
  const safeIndex = Math.max(0, Math.min(route.length - 1, Math.floor(index)));
  const total = route.slice(1).reduce((sum, point, routeIndex) => sum + segmentLength(route[routeIndex]!, point), 0) || 1;
  const distance = route.slice(1, safeIndex + 1).reduce((sum, point, routeIndex) => sum + segmentLength(route[routeIndex]!, point), 0);
  return clamp01(distance / total);
};

const routePointAtDistance = (distance: number, route: readonly AthleticsRoutePoint[]) => {
  const { lengths, total } = routeLengths({ route });
  let remaining = Math.min(total, Math.max(0, distance));
  for (let index = 0; index < lengths.length; index += 1) {
    const start = route[index]!;
    const end = route[index + 1]!;
    const length = lengths[index]!;
    if (remaining <= length || index === lengths.length - 1) {
      const part = length <= 0 ? 0 : Math.min(1, Math.max(0, remaining / length));
      return {
        x: start.x + (end.x - start.x) * part,
        y: start.y + (end.y - start.y) * part,
        z: start.z + (end.z - start.z) * part
      };
    }
    remaining -= length;
  }
  return route[route.length - 1]!;
};

const routePointAtProgressUnchecked = (progress: number, route: readonly AthleticsRoutePoint[]) => {
  const { total } = routeLengths({ route });
  return routePointAtDistance(clamp01(progress) * total, route);
};

/**
 * Six compact, hand-authored parkour chapters climb through the park. Each
 * point is a landing centre, not a piece of a continuous runway: the authored
 * surface dimensions and transition table below decide whether the next move
 * is a jump, lift, bridge, or checkpoint entry.
 */
const ATHLETICS_ROUTE: readonly AthleticsRoutePoint[] = [
  // Park Entrance: low, forgiving tutorial landings with two similar-height
  // jumps before the route begins to weave through the park.
  { x: 0, z: 123, y: 0 },
  { x: -4.1, z: 105.8, y: 0 },
  { x: 10.2, z: 90.8, y: 1.5 },
  { x: -3, z: 78, y: 0.5 },
  { x: 10.8, z: 62.9, y: 2.5 },
  { x: 0, z: 46, y: 2.5 },
  { x: 16.5, z: 33.5, y: 4 },
  { x: 2, z: 20, y: 3 },
  { x: -12, z: 8, y: 5 },
  { x: 0, z: -9, y: 5 },
  { x: -17, z: -22, y: 6 },
  // Midway Mayhem: lateral movement around the low midway, with small rises
  // and drops rather than a vertical staircase.
  { x: -35, z: -33, y: 6 },
  { x: -49, z: -21, y: 7 },
  { x: -63, z: -33, y: 6 },
  { x: -79, z: -46, y: 8 },
  { x: -64, z: -62, y: 8 },
  { x: -47, z: -71, y: 7 },
  { x: -27, z: -63, y: 9 },
  { x: -11, z: -78, y: 8 },
  { x: 7, z: -67, y: 10 },
  { x: 24, z: -78, y: 9 },
  { x: 41, z: -66, y: 10 },
  // Ride District: a long lateral ride deck, then a distinct lift-assisted
  // climb into the attraction skyline.
  { x: 54, z: -47, y: 11 },
  { x: 42, z: -32, y: 11 },
  { x: 27, z: -40, y: 12 },
  { x: 12, z: -26, y: 12 },
  { x: 25, z: -8, y: 13 },
  { x: 44, z: 3, y: 13 },
  { x: 58, z: 19, y: 13 },
  { x: 44, z: 36, y: 14 },
  { x: 29, z: 26, y: 13 },
  { x: 11, z: 39, y: 16 },
  { x: -8, z: 28, y: 16 },
  // Ferris & Coaster: approach the grounded wheel's lower deck, cross its
  // moving gondola line, then climb to the supported coaster maintenance run.
  { x: -24, z: 17, y: 16 },
  { x: -40, z: 28, y: 18 },
  { x: -56, z: 39, y: 18 },
  { x: -72, z: 28, y: 21 },
  { x: -86, z: 15, y: 24 },
  { x: -96, z: 31, y: 27 },
  { x: -85, z: 48, y: 30 },
  { x: -67.5, z: 59.5, y: 29 },
  { x: -48, z: 52, y: 32 },
  { x: -30, z: 44, y: 34 },
  { x: -17, z: 58, y: 34 },
  // Drop Tower: three service-deck jumps, a sharp lift, then a dropping
  // diagonal that turns toward the next checkpoint.
  { x: -3, z: 44, y: 36 },
  { x: 14, z: 31, y: 36 },
  { x: 30, z: 44, y: 38 },
  { x: 47, z: 30, y: 38 },
  { x: 62.5, z: 14.5, y: 40 },
  { x: 49, z: -1, y: 40 },
  { x: 32.5, z: -15.5, y: 40 },
  { x: 16, z: -1, y: 55 },
  { x: 1, z: -15, y: 58 },
  { x: -18, z: -4, y: 60 },
  { x: -35, z: -19, y: 62 },
  // Sky Park Summit: exposed lateral traversal at a stable high level before
  // the final sharp ascent above the whole park.
  { x: -52, z: -33, y: 62 },
  { x: -70, z: -20, y: 65 },
  { x: -86, z: -34, y: 65 },
  { x: -103, z: -20, y: 67 },
  { x: -92, z: -2, y: 69 },
  { x: -74, z: 8, y: 71 },
  { x: -54, z: -4.5, y: 74 },
  { x: -35, z: 7, y: 77 },
  { x: -17, z: -3, y: 80 },
  { x: 2, z: 12, y: 110 }
];

const sectionAt = (startIndex: number, endIndex: number, id: string, label: string, description: string, accent: AthleticsAccent, landmark: string): AthleticsCourseSection => ({
  id,
  label,
  description,
  startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, startIndex),
  endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, endIndex),
  accent,
  landmark
});

const ATHLETICS_SECTIONS: readonly AthleticsCourseSection[] = [
  sectionAt(0, 10, "park-entrance", "Park Entrance", "Learn the jump rhythm on wide, low ticket-plaza landings.", "cyan", "Grand entrance"),
  sectionAt(10, 21, "midway-mayhem", "Midway Mayhem", "Thread the midway laterally while small rises and drops keep the rhythm alive.", "orange", "Food stalls and bumper cars"),
  sectionAt(21, 32, "ride-district", "Ride District", "Cross ride decks, time the lift, and gain height in one deliberate attraction beat.", "lime", "Ride decks and maintenance lift"),
  sectionAt(32, 43, "ferris-coaster", "Ferris & Coaster", "Use the grounded Ferris support decks and a supported coaster line as real landmarks.", "gold", "Ferris wheel and coaster"),
  sectionAt(43, 54, "drop-tower", "Drop Tower", "Climb in service-deck chunks, ride the tower lift, and drop into the next checkpoint.", "violet", "Drop tower"),
  sectionAt(54, 64, "sky-park-summit", "Sky Park Summit", "Stay exposed across the high traverse, then make the sharp final ascent above the park.", "pink", "Summit flags")
];

type AuthoredSurfaceSpec = Pick<AthleticsCourseSurface, "kind" | "width" | "depth" | "safe" | "material" | "rotationY">;

const surfaceSpec = (
  kind: AthleticsSurfaceKind,
  width: number,
  depth: number,
  material: AthleticsCourseSurface["material"],
  safe = false,
  rotationY?: number
): AuthoredSurfaceSpec => ({ kind, width, depth, material, safe, ...(rotationY === undefined ? {} : { rotationY }) });

/** Explicit surface tuning; there is no modulo-based sampling or auto-fill. */
const ATHLETICS_SURFACE_SPECS: readonly AuthoredSurfaceSpec[] = [
  // Park Entrance: wide, forgiving teaching landings.
  surfaceSpec("platform", 20, 16, "stone", true),
  surfaceSpec("platform", 18, 13, "stone"),
  surfaceSpec("platform", 17, 13, "stone"),
  surfaceSpec("platform", 16, 13, "accent"),
  surfaceSpec("platform", 17, 13, "accent"),
  surfaceSpec("platform", 16, 11, "accent"),
  surfaceSpec("platform", 16, 13, "accent"),
  surfaceSpec("ramp", 16, 13, "accent"),
  surfaceSpec("platform", 16, 13, "metal"),
  surfaceSpec("platform", 16, 13, "metal"),
  surfaceSpec("checkpoint", 26, 18, "accent", true),
  // Midway Mayhem: smaller lateral landings around grounded stalls.
  surfaceSpec("platform", 15, 12, "wood"),
  surfaceSpec("platform", 14, 10, "wood"),
  surfaceSpec("platform", 14, 11, "metal"),
  surfaceSpec("platform", 16, 14, "wood"),
  surfaceSpec("platform", 14, 12, "wood"),
  surfaceSpec("platform", 13, 12, "metal"),
  surfaceSpec("platform", 14, 12, "wood"),
  surfaceSpec("ramp", 13, 12, "wood"),
  surfaceSpec("platform", 14, 12, "metal"),
  surfaceSpec("platform", 15, 13, "wood"),
  surfaceSpec("checkpoint", 26, 18, "accent", true),
  // Ride District: ride decks use a tighter but still comfortable footprint.
  surfaceSpec("platform", 14, 12, "metal"),
  surfaceSpec("platform", 13, 12, "metal"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("platform", 15, 13, "metal", true),
  surfaceSpec("platform", 13, 11, "accent"),
  surfaceSpec("platform", 13, 12, "metal"),
  surfaceSpec("ramp", 14, 12, "accent"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("platform", 14, 12, "accent"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("checkpoint", 26, 18, "accent", true),
  // Ferris & Coaster: support decks and gondola landings.
  surfaceSpec("platform", 14, 12, "metal"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("platform", 14, 12, "metal", true),
  surfaceSpec("platform", 12, 11, "accent"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("ramp", 12, 11, "accent"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("platform", 12, 10, "accent"),
  surfaceSpec("platform", 13, 11, "metal"),
  surfaceSpec("platform", 13, 12, "metal"),
  surfaceSpec("checkpoint", 28, 18, "accent", true),
  // Drop Tower: service decks are intentionally varied and never a repeated stair flight.
  surfaceSpec("platform", 13, 13, "metal"),
  surfaceSpec("platform", 12, 13, "metal"),
  surfaceSpec("ramp", 13, 13, "accent"),
  surfaceSpec("platform", 12, 12, "metal"),
  surfaceSpec("platform", 13, 13, "metal"),
  surfaceSpec("platform", 12, 12, "accent"),
  surfaceSpec("platform", 13, 13, "metal"),
  surfaceSpec("platform", 12, 13, "metal"),
  surfaceSpec("platform", 13, 13, "accent"),
  surfaceSpec("platform", 12, 12, "metal"),
  surfaceSpec("checkpoint", 28, 18, "accent", true),
  // Sky Park Summit: exposed high landings with a generous final finish pad.
  surfaceSpec("platform", 13, 13, "accent"),
  surfaceSpec("platform", 12, 12, "metal"),
  surfaceSpec("platform", 12, 12, "accent"),
  surfaceSpec("platform", 13, 13, "metal"),
  surfaceSpec("platform", 12, 12, "accent"),
  surfaceSpec("platform", 13, 13, "metal"),
  surfaceSpec("platform", 11, 12, "accent"),
  surfaceSpec("platform", 12, 12, "metal"),
  surfaceSpec("platform", 12, 12, "accent"),
  surfaceSpec("checkpoint", 30, 22, "accent", true)
];

const routeHeadingAtIndex = (route: readonly AthleticsRoutePoint[], index: number) => {
  const point = route[index]!;
  const previous = route[index - 1];
  if (!previous) {
    const next = route[index + 1] ?? point;
    return Math.atan2(next.x - point.x, next.z - point.z);
  }
  return Math.atan2(point.x - previous.x, point.z - previous.z);
};

const makeAuthoredSurfaces = (route: readonly AthleticsRoutePoint[], specs: readonly AuthoredSurfaceSpec[]) => {
  if (route.length !== specs.length) throw new Error(`Athletics route/surface authoring mismatch: ${route.length} route points, ${specs.length} specs`);
  return route.map((point, index) => ({
    ...specs[index]!,
    id: `route-platform-${String(index + 1).padStart(3, "0")}`,
    x: point.x,
    z: point.z,
    y: point.y,
    // Normal landings face the jump they receive; checkpoint pads face their
    // exit so the large safe surface also communicates the next direction.
    rotationY: specs[index]?.rotationY ?? (specs[index]?.kind === "checkpoint" && route[index + 1]
      ? Math.atan2(route[index + 1]!.x - point.x, route[index + 1]!.z - point.z)
      : routeHeadingAtIndex(route, index))
  } satisfies AthleticsCourseSurface));
};

const ATHLETICS_SURFACES = makeAuthoredSurfaces(ATHLETICS_ROUTE, ATHLETICS_SURFACE_SPECS);
const ATHLETICS_CHECKPOINTS = [10, 21, 32, 43, 54, 64].map((index) => routeProgressAtIndex(ATHLETICS_ROUTE, index));

const routeSurfaceId = (index: number) => `route-platform-${String(index + 1).padStart(3, "0")}`;

const shortcutSurface = (
  id: string,
  kind: AthleticsSurfaceKind,
  x: number,
  z: number,
  y: number,
  width: number,
  depth: number,
  material: AthleticsCourseSurface["material"] = "accent",
  rotationY = 0
): AthleticsCourseSurface => ({ id, kind, x, z, y, width, depth, safe: false, material, rotationY });

const ATHLETICS_SHORTCUTS: readonly AthleticsCourseShortcut[] = [
  {
    id: "midway-service-cut",
    label: "Midway service cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 12),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 15),
    route: [
      ATHLETICS_ROUTE[12]!,
      { x: -48, z: -40, y: 7 },
      { x: -44, z: -56, y: 7 },
      ATHLETICS_ROUTE[15]!
    ],
    surfaces: [
      shortcutSurface("shortcut-midway-service-01", "platform", -48, -40, 7, 9, 8, "wood", Math.atan2(4, -16)),
      shortcutSurface("shortcut-midway-service-02", "platform", -44, -56, 7, 9, 8, "metal", Math.atan2(-20, -6))
    ],
    transitions: [
      { id: "midway-service-cut-01", fromSurfaceId: routeSurfaceId(12), toSurfaceId: "shortcut-midway-service-01", type: "shortcut_jump", note: "Clear the service gap from the midway awning." },
      { id: "midway-service-cut-02", fromSurfaceId: "shortcut-midway-service-01", toSurfaceId: "shortcut-midway-service-02", type: "shortcut_jump" },
      { id: "midway-service-cut-03", fromSurfaceId: "shortcut-midway-service-02", toSurfaceId: routeSurfaceId(15), type: "shortcut_jump", note: "Land on the far midway deck." }
    ],
    routeWidth: 12
  },
  {
    id: "ferris-maintenance-cut",
    label: "Ferris maintenance cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 34),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 39),
    route: [
      ATHLETICS_ROUTE[34]!,
      { x: -51, z: 12, y: 18 },
      { x: -65, z: 18, y: 20 },
      { x: -80, z: 30, y: 24 },
      ATHLETICS_ROUTE[39]!
    ],
    surfaces: [
      shortcutSurface("shortcut-ferris-maintenance-01", "platform", -51, 12, 18, 8, 7, "metal", Math.atan2(-14, 6)),
      shortcutSurface("shortcut-ferris-maintenance-02", "platform", -65, 18, 20, 8, 8, "accent", Math.atan2(-15, 12)),
      shortcutSurface("shortcut-ferris-maintenance-03", "platform", -80, 30, 24, 8, 8, "metal", Math.atan2(-5, 18))
    ],
    transitions: [
      { id: "ferris-maintenance-cut-01", fromSurfaceId: routeSurfaceId(34), toSurfaceId: "shortcut-ferris-maintenance-01", type: "shortcut_jump", note: "Skip across the lower wheel service rail." },
      { id: "ferris-maintenance-cut-02", fromSurfaceId: "shortcut-ferris-maintenance-01", toSurfaceId: "shortcut-ferris-maintenance-02", type: "shortcut_jump" },
      { id: "ferris-maintenance-cut-03", fromSurfaceId: "shortcut-ferris-maintenance-02", toSurfaceId: "shortcut-ferris-maintenance-03", type: "shortcut_jump" },
      { id: "ferris-maintenance-cut-04", fromSurfaceId: "shortcut-ferris-maintenance-03", toSurfaceId: routeSurfaceId(39), type: "shortcut_jump", note: "Rejoin above the coaster approach." }
    ],
    routeWidth: 12
  },
  {
    id: "drop-tower-rooftop-cut",
    label: "Drop tower rooftop cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 47),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 51),
    route: [
      ATHLETICS_ROUTE[47]!,
      { x: 60, z: 16, y: 42 },
      { x: 49, z: 0, y: 47 },
      { x: 33, z: -12, y: 51 },
      ATHLETICS_ROUTE[51]!
    ],
    surfaces: [
      shortcutSurface("shortcut-drop-rooftop-01", "platform", 60, 16, 42, 12, 11, "accent", Math.atan2(-11, -16)),
      shortcutSurface("shortcut-drop-rooftop-02", "ramp", 49, 0, 47, 12, 11, "metal", Math.atan2(-16, -12)),
      shortcutSurface("shortcut-drop-rooftop-03", "platform", 33, -12, 51, 12, 11, "accent", Math.atan2(-17, 11))
    ],
    transitions: [
      { id: "drop-tower-rooftop-cut-01", fromSurfaceId: routeSurfaceId(47), toSurfaceId: "shortcut-drop-rooftop-01", type: "shortcut_jump", note: "Leap from the tower deck to the rooftop line." },
      { id: "drop-tower-rooftop-cut-02", fromSurfaceId: "shortcut-drop-rooftop-01", toSurfaceId: "shortcut-drop-rooftop-02", type: "shortcut_jump" },
      { id: "drop-tower-rooftop-cut-03", fromSurfaceId: "shortcut-drop-rooftop-02", toSurfaceId: "shortcut-drop-rooftop-03", type: "shortcut_jump" },
      { id: "drop-tower-rooftop-cut-04", fromSurfaceId: "shortcut-drop-rooftop-03", toSurfaceId: routeSurfaceId(51), type: "shortcut_jump", note: "Drop onto the high service landing." }
    ],
    routeWidth: 12
  }
];

const mainTransition = (
  index: number,
  type: AthleticsTransitionType,
  note?: string,
  movingObstacleId?: string
): AthleticsCourseTransition => ({
  id: `main-transition-${String(index + 1).padStart(3, "0")}`,
  fromSurfaceId: routeSurfaceId(index),
  toSurfaceId: routeSurfaceId(index + 1),
  type,
  ...(note ? { note } : {}),
  ...(movingObstacleId ? { movingObstacleId } : {})
});

/**
 * Main-route transition authoring. Checkpoint entries and the ride elevator are
 * deliberately named non-jump interactions; all other transitions are
 * required to clear a gap, with six moving interactions called out for QA and
 * future tooling.
 */
const ATHLETICS_TRANSITIONS: readonly AthleticsCourseTransition[] = ATHLETICS_ROUTE.slice(0, -1).map((_, index) => {
  const moving: Record<number, [string, string]> = {
    13: ["midway-swing-platform", "Time the swing from the midway deck."],
    24: ["ride-district-lift", "Use the maintenance lift to gain the ride-deck height."],
    35: ["ferris-gondola-crossing", "Cross the Ferris gondola line."],
    39: ["coaster-maintenance-cart", "Clear the coaster maintenance cart."],
    50: ["drop-tower-lift", "Ride the Drop Tower lift into the upper service line."],
    63: ["summit-finish-lift", "Ride the final summit lift into the finish platform."]
  };
  const checkpointEntry = new Set([9, 20, 31, 42, 53, 63]).has(index);
  const movingTransition = moving[index];
  if (checkpointEntry) {
    return mainTransition(
      index,
      "checkpoint_entry",
      movingTransition?.[1] ?? "Wide recovery platform and checkpoint arch.",
      movingTransition?.[0]
    );
  }
  if (movingTransition) return mainTransition(index, "moving_jump", movingTransition[1], movingTransition[0]);
  if (index === 26) return mainTransition(index, "elevator", "The route changes level at the ride maintenance elevator.");
  if ([33, 36, 38, 40].includes(index)) return mainTransition(index, "attraction", "The landing is authored against a recognizable attraction structure.");
  if ([51, 57, 60, 61, 62].includes(index)) return mainTransition(index, "hard_jump", "Long exposed late-course jump with a readable landing.");
  if (index < 9) return mainTransition(index, "easy_jump", "Forgiving tutorial air gap.");
  return mainTransition(index, "jump");
});

const ATHLETICS_MOVING_OBSTACLES: readonly AthleticsMovingObstacle[] = [
  { id: "midway-swing-platform", kind: "platform", x: -63, z: -39, y: 7, width: 11, depth: 8, height: 1.2, axis: "x", amplitude: 6, periodMs: 4200, phaseMs: 300, material: "wood", jumpable: true },
  { id: "ride-district-lift", kind: "elevator", x: 39, z: -17, y: 13, width: 11, depth: 10, height: 1.2, axis: "y", amplitude: 5, periodMs: 5600, phaseMs: 900, material: "metal", jumpable: true },
  { id: "ferris-gondola-crossing", kind: "platform", x: -72, z: 28, y: 21, width: 10, depth: 7, height: 1.2, axis: "z", amplitude: 5, periodMs: 3900, phaseMs: 1100, material: "accent", jumpable: true },
  { id: "coaster-maintenance-cart", kind: "barrier", x: -67, z: 55, y: 31, width: 9, depth: 3, height: 1.4, axis: "x", amplitude: 6, periodMs: 4700, phaseMs: 1500, material: "metal", jumpable: true },
  { id: "drop-tower-lift", kind: "elevator", x: 35, z: -9, y: 43, width: 11, depth: 10, height: 1.2, axis: "y", amplitude: 12, periodMs: 6000, phaseMs: 200, material: "metal", jumpable: true },
  { id: "summit-finish-lift", kind: "elevator", x: -8, z: 5, y: 95, width: 11, depth: 10, height: 1.2, axis: "y", amplitude: 15, periodMs: 6600, phaseMs: 700, material: "accent", jumpable: true }
];

export const ATHLETICS_STADIUM_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop",
  title: "Skyline Adventure Park",
  subtitle: "Answer for energy. Jump the attractions. Reach the summit.",
  route: ATHLETICS_ROUTE,
  sections: ATHLETICS_SECTIONS,
  checkpoints: ATHLETICS_CHECKPOINTS,
  surfaces: ATHLETICS_SURFACES,
  transitions: ATHLETICS_TRANSITIONS,
  shortcuts: ATHLETICS_SHORTCUTS,
  movingObstacles: ATHLETICS_MOVING_OBSTACLES,
  routeWidth: 14,
  finishThreshold: 0.982,
  bounds: ATHLETICS_COURSE_BOUNDS
};

/** Minimum authored edge-to-edge air for each transition vocabulary item. */
export const ATHLETICS_TRANSITION_AIR_GAP_TARGETS: Readonly<Record<AthleticsTransitionType, number>> = {
  jump: 4,
  easy_jump: 2.5,
  hard_jump: 6,
  shortcut_jump: 3,
  moving_jump: 3,
  attraction: 4,
  connected: 0,
  checkpoint_entry: 0,
  elevator: 0,
  bridge: 0
};

const ATHLETICS_JUMP_TRANSITION_TYPES: readonly AthleticsTransitionType[] = [
  "jump",
  "easy_jump",
  "hard_jump",
  "shortcut_jump",
  "moving_jump",
  "attraction"
];

const ATHLETICS_INTENTIONAL_NON_JUMP_TYPES: readonly AthleticsTransitionType[] = [
  "connected",
  "checkpoint_entry",
  "elevator",
  "bridge"
];

export const isAthleticsJumpTransition = (type: AthleticsTransitionType) =>
  ATHLETICS_JUMP_TRANSITION_TYPES.includes(type);

type AthleticsFootprintPoint = { x: number; z: number };

const footprintCorners = (surface: Pick<AthleticsCourseSurface, "x" | "z" | "width" | "depth" | "rotationY">): AthleticsFootprintPoint[] => {
  const angle = surface.rotationY ?? 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return ([
    [-surface.width / 2, -surface.depth / 2],
    [surface.width / 2, -surface.depth / 2],
    [surface.width / 2, surface.depth / 2],
    [-surface.width / 2, surface.depth / 2]
  ] as const).map(([localX, localZ]) => ({
    x: surface.x + cosine * localX + sine * localZ,
    z: surface.z - sine * localX + cosine * localZ
  }));
};

const crossFootprint = (first: AthleticsFootprintPoint, second: AthleticsFootprintPoint, third: AthleticsFootprintPoint) =>
  (second.x - first.x) * (third.z - first.z) - (second.z - first.z) * (third.x - first.x);

const pointOnFootprintSegment = (point: AthleticsFootprintPoint, start: AthleticsFootprintPoint, end: AthleticsFootprintPoint) =>
  Math.abs(crossFootprint(start, end, point)) <= 0.000001
  && point.x >= Math.min(start.x, end.x) - 0.000001
  && point.x <= Math.max(start.x, end.x) + 0.000001
  && point.z >= Math.min(start.z, end.z) - 0.000001
  && point.z <= Math.max(start.z, end.z) + 0.000001;

const footprintSegmentsIntersect = (
  firstStart: AthleticsFootprintPoint,
  firstEnd: AthleticsFootprintPoint,
  secondStart: AthleticsFootprintPoint,
  secondEnd: AthleticsFootprintPoint
) => {
  const firstTurn = crossFootprint(firstStart, firstEnd, secondStart);
  const secondTurn = crossFootprint(firstStart, firstEnd, secondEnd);
  const thirdTurn = crossFootprint(secondStart, secondEnd, firstStart);
  const fourthTurn = crossFootprint(secondStart, secondEnd, firstEnd);
  const straddles = ((firstTurn > 0 && secondTurn < 0) || (firstTurn < 0 && secondTurn > 0))
    && ((thirdTurn > 0 && fourthTurn < 0) || (thirdTurn < 0 && fourthTurn > 0));
  return straddles
    || (Math.abs(firstTurn) <= 0.000001 && pointOnFootprintSegment(secondStart, firstStart, firstEnd))
    || (Math.abs(secondTurn) <= 0.000001 && pointOnFootprintSegment(secondEnd, firstStart, firstEnd))
    || (Math.abs(thirdTurn) <= 0.000001 && pointOnFootprintSegment(firstStart, secondStart, secondEnd))
    || (Math.abs(fourthTurn) <= 0.000001 && pointOnFootprintSegment(firstEnd, secondStart, secondEnd));
};

const pointInsideFootprint = (point: AthleticsFootprintPoint, polygon: readonly AthleticsFootprintPoint[]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const intersects = ((current.z > point.z) !== (prior.z > point.z))
      && point.x < ((prior.x - current.x) * (point.z - current.z)) / (prior.z - current.z) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

const distanceToFootprintSegment = (point: AthleticsFootprintPoint, start: AthleticsFootprintPoint, end: AthleticsFootprintPoint) => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const part = lengthSquared <= Number.EPSILON
    ? 0
    : Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * part), point.z - (start.z + dz * part));
};

/**
 * Returns the true horizontal edge-to-edge distance between two landing
 * rectangles. Touching or intersecting rectangles return zero; this is not a
 * centre-to-centre measurement and it respects authored rotationY.
 */
export const getAthleticsSurfaceAirGap = (
  first: Pick<AthleticsCourseSurface, "x" | "z" | "width" | "depth" | "rotationY">,
  second: Pick<AthleticsCourseSurface, "x" | "z" | "width" | "depth" | "rotationY">
) => {
  const firstCorners = footprintCorners(first);
  const secondCorners = footprintCorners(second);
  for (let firstIndex = 0; firstIndex < firstCorners.length; firstIndex += 1) {
    const firstStart = firstCorners[firstIndex]!;
    const firstEnd = firstCorners[(firstIndex + 1) % firstCorners.length]!;
    for (let secondIndex = 0; secondIndex < secondCorners.length; secondIndex += 1) {
      const secondStart = secondCorners[secondIndex]!;
      const secondEnd = secondCorners[(secondIndex + 1) % secondCorners.length]!;
      if (footprintSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
    }
  }
  if (pointInsideFootprint(firstCorners[0]!, secondCorners) || pointInsideFootprint(secondCorners[0]!, firstCorners)) return 0;
  let closest = Number.POSITIVE_INFINITY;
  for (const point of firstCorners) {
    for (let index = 0; index < secondCorners.length; index += 1) {
      closest = Math.min(closest, distanceToFootprintSegment(point, secondCorners[index]!, secondCorners[(index + 1) % secondCorners.length]!));
    }
  }
  for (const point of secondCorners) {
    for (let index = 0; index < firstCorners.length; index += 1) {
      closest = Math.min(closest, distanceToFootprintSegment(point, firstCorners[index]!, firstCorners[(index + 1) % firstCorners.length]!));
    }
  }
  return Number.isFinite(closest) ? closest : 0;
};

/**
 * Returns whether two authored landing slabs occupy the same solid volume.
 * Horizontal crossings at different heights are allowed for the compact
 * park, but a same-height crossing is a design error unless its transition is
 * explicitly authored as a non-jump interaction.
 */
export const getAthleticsSurfaceVolumeOverlap = (
  first: Pick<AthleticsCourseSurface, "x" | "z" | "y" | "width" | "depth" | "rotationY">,
  second: Pick<AthleticsCourseSurface, "x" | "z" | "y" | "width" | "depth" | "rotationY">
) => {
  const firstBottom = first.y - (first.y <= 0 ? ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT : ATHLETICS_SURFACE_SLAB_HEIGHT);
  const secondBottom = second.y - (second.y <= 0 ? ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT : ATHLETICS_SURFACE_SLAB_HEIGHT);
  const verticalOverlap = Math.min(first.y, second.y) - Math.max(firstBottom, secondBottom);
  return verticalOverlap > 0.001 && getAthleticsSurfaceAirGap(first, second) <= 0.001;
};

const allAthleticsSurfaces = (course: AthleticsCourseDefinition) => [
  ...course.surfaces,
  ...course.shortcuts.flatMap((shortcut) => shortcut.surfaces)
];

const surfaceById = (course: AthleticsCourseDefinition, id: string) => allAthleticsSurfaces(course).find((surface) => surface.id === id);

export const getAthleticsTransitionAirGap = (
  transition: AthleticsCourseTransition,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const first = surfaceById(course, transition.fromSurfaceId);
  const second = surfaceById(course, transition.toSurfaceId);
  return first && second ? getAthleticsSurfaceAirGap(first, second) : Number.NaN;
};

export interface AthleticsCourseGeometryMetrics {
  mainRoutePlatformCount: number;
  transitionCount: number;
  nonCheckpointTransitionCount: number;
  checkpointTransitionCount: number;
  genuineJumpTransitionCount: number;
  positiveAirGapJumpCount: number;
  jumpTransitionAirGapPercentage: number;
  jumpTransitionPercentage: number;
  medianAirGap: number;
  averageAirGap: number;
  maximumNormalRouteGap: number;
  maximumShortcutGap: number;
  connectedNonJumpTransitionCount: number;
  movingPlatformTransitionCount: number;
  averagePlatformWidth: number;
  averagePlatformDepth: number;
}

const median = (values: readonly number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};

export const getAthleticsCourseGeometryMetrics = (
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
): AthleticsCourseGeometryMetrics => {
  const mainAirGaps = course.transitions.map((transition) => getAthleticsTransitionAirGap(transition, course));
  const jumpGaps = course.transitions
    .filter((transition) => isAthleticsJumpTransition(transition.type))
    .map((transition) => getAthleticsTransitionAirGap(transition, course))
    .filter((gap): gap is number => Number.isFinite(gap));
  const shortcutGaps = course.shortcuts.flatMap((shortcut) => shortcut.transitions.map((transition) => getAthleticsTransitionAirGap(transition, course)))
    .filter((gap): gap is number => Number.isFinite(gap));
  const nonCheckpointTransitions = course.transitions.filter((transition) => transition.type !== "checkpoint_entry");
  const positiveAirGapJumpCount = jumpGaps.filter((gap) => gap > 0.001).length;
  const average = jumpGaps.length === 0 ? 0 : jumpGaps.reduce((sum, gap) => sum + gap, 0) / jumpGaps.length;
  const routeGaps = mainAirGaps.filter((gap, index) => Number.isFinite(gap) && course.transitions[index]!.type !== "checkpoint_entry") as number[];
  const surfaces = course.surfaces;
  return {
    mainRoutePlatformCount: course.surfaces.length,
    transitionCount: course.transitions.length,
    nonCheckpointTransitionCount: nonCheckpointTransitions.length,
    checkpointTransitionCount: course.transitions.length - nonCheckpointTransitions.length,
    genuineJumpTransitionCount: jumpGaps.length,
    positiveAirGapJumpCount,
    jumpTransitionAirGapPercentage: jumpGaps.length === 0 ? 0 : (positiveAirGapJumpCount / jumpGaps.length) * 100,
    jumpTransitionPercentage: nonCheckpointTransitions.length === 0 ? 0 : (jumpGaps.length / nonCheckpointTransitions.length) * 100,
    medianAirGap: median(jumpGaps),
    averageAirGap: average,
    maximumNormalRouteGap: routeGaps.length === 0 ? 0 : Math.max(...routeGaps),
    maximumShortcutGap: shortcutGaps.length === 0 ? 0 : Math.max(...shortcutGaps),
    connectedNonJumpTransitionCount: course.transitions.filter((transition) => ATHLETICS_INTENTIONAL_NON_JUMP_TYPES.includes(transition.type)).length,
    movingPlatformTransitionCount: course.transitions.filter((transition) => transition.movingObstacleId !== undefined).length,
    averagePlatformWidth: surfaces.reduce((sum, surface) => sum + surface.width, 0) / Math.max(1, surfaces.length),
    averagePlatformDepth: surfaces.reduce((sum, surface) => sum + surface.depth, 0) / Math.max(1, surfaces.length)
  };
};

export const getAthleticsCourseGeometryIssues = (
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const issues: string[] = [];
  const movingObstacleIds = new Set(course.movingObstacles.map((obstacle) => obstacle.id));
  const checkMovingReference = (transition: AthleticsCourseTransition, label: string) => {
    if (transition.type === "moving_jump" && !transition.movingObstacleId) {
      issues.push(`${label} moving_jump has no moving obstacle reference`);
    }
    if (transition.movingObstacleId && !movingObstacleIds.has(transition.movingObstacleId)) {
      issues.push(`${label} references missing moving obstacle ${transition.movingObstacleId}`);
    }
  };
  if (course.transitions.length !== Math.max(0, course.surfaces.length - 1)) {
    issues.push(`main transition count ${course.transitions.length} does not match ${course.surfaces.length - 1} surface transitions`);
  }
  course.transitions.forEach((transition, index) => {
    checkMovingReference(transition, transition.id);
    const expectedFrom = course.surfaces[index]?.id;
    const expectedTo = course.surfaces[index + 1]?.id;
    if (transition.fromSurfaceId !== expectedFrom || transition.toSurfaceId !== expectedTo) {
      issues.push(`${transition.id} is not adjacent to main route surfaces ${index} and ${index + 1}`);
    }
    const gap = getAthleticsTransitionAirGap(transition, course);
    const minimum = ATHLETICS_TRANSITION_AIR_GAP_TARGETS[transition.type];
    if (!Number.isFinite(gap)) issues.push(`${transition.id} references a missing surface`);
    if (isAthleticsJumpTransition(transition.type) && Number.isFinite(gap) && gap < minimum) {
      issues.push(`${transition.id} ${transition.type} air gap ${gap.toFixed(2)} is below ${minimum.toFixed(2)}`);
    }
    if (Number.isFinite(gap) && gap <= 0.001 && isAthleticsJumpTransition(transition.type)) {
      issues.push(`${transition.id} has accidental platform overlap but is typed as ${transition.type}`);
    }
    if (!isAthleticsJumpTransition(transition.type) && !ATHLETICS_INTENTIONAL_NON_JUMP_TYPES.includes(transition.type)) {
      issues.push(`${transition.id} uses an unknown non-jump transition type`);
    }
  });
  for (const shortcut of course.shortcuts) {
    for (const transition of shortcut.transitions) {
      checkMovingReference(transition, `${shortcut.id}/${transition.id}`);
      const gap = getAthleticsTransitionAirGap(transition, course);
      const minimum = ATHLETICS_TRANSITION_AIR_GAP_TARGETS[transition.type];
      if (!Number.isFinite(gap)) issues.push(`${shortcut.id}/${transition.id} references a missing surface`);
      if (isAthleticsJumpTransition(transition.type) && Number.isFinite(gap) && gap < minimum) {
        issues.push(`${shortcut.id}/${transition.id} air gap ${gap.toFixed(2)} is below ${minimum.toFixed(2)}`);
      }
      if (Number.isFinite(gap) && gap <= 0.001 && isAthleticsJumpTransition(transition.type)) {
        issues.push(`${shortcut.id}/${transition.id} has accidental platform overlap but is typed as ${transition.type}`);
      }
      if (!isAthleticsJumpTransition(transition.type) && !ATHLETICS_INTENTIONAL_NON_JUMP_TYPES.includes(transition.type)) {
        issues.push(`${shortcut.id}/${transition.id} uses an unknown non-jump transition type`);
      }
    }
  }
  const intentionalNonJumpPairs = new Set(
    course.transitions
      .filter((transition) => ATHLETICS_INTENTIONAL_NON_JUMP_TYPES.includes(transition.type))
      .map((transition) => `${transition.fromSurfaceId}|${transition.toSurfaceId}`)
  );
  const allSurfaces = [
    ...course.surfaces,
    ...course.shortcuts.flatMap((shortcut) => shortcut.surfaces)
  ];
  for (let firstIndex = 0; firstIndex < allSurfaces.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < allSurfaces.length; secondIndex += 1) {
      const first = allSurfaces[firstIndex]!;
      const second = allSurfaces[secondIndex]!;
      if (!getAthleticsSurfaceVolumeOverlap(first, second)) continue;
      const pair = `${first.id}|${second.id}`;
      const reversePair = `${second.id}|${first.id}`;
      if (intentionalNonJumpPairs.has(pair) || intentionalNonJumpPairs.has(reversePair)) continue;
      issues.push(`${first.id} and ${second.id} occupy the same authored solid volume`);
    }
  }
  const metrics = getAthleticsCourseGeometryMetrics(course);
  if (metrics.jumpTransitionPercentage < 75) {
    issues.push(`only ${metrics.jumpTransitionPercentage.toFixed(1)}% of non-checkpoint transitions are authored jumps`);
  }
  return issues;
};

export const ATHLETICS_START_COUNTDOWN_MS = 4_000;
export const ATHLETICS_WRONG_ANSWER_PENALTY_MS = 900;
export const ATHLETICS_RESPAWN_PENALTY_MS = 1_200;
export const ATHLETICS_LAP_TRANSITION_MS = 1_500;
export const ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS = 270;
export const ATHLETICS_DEFAULT_COURSE_LAPS = 1;
export const ATHLETICS_MAX_COURSE_LAPS = 10;
export const ATHLETICS_MAX_QUESTIONS_PER_LAP = 8;

export const sanitizeAthleticsCourseLaps = (value: unknown) => {
  const laps = Number(value);
  return Number.isInteger(laps) && laps >= ATHLETICS_DEFAULT_COURSE_LAPS && laps <= ATHLETICS_MAX_COURSE_LAPS
    ? laps
    : ATHLETICS_DEFAULT_COURSE_LAPS;
};

/**
 * One-lap rooms retain the original one-question-per-item behavior. Longer
 * races distribute a set across laps, cap checkpoint density, then cycle the
 * question pool deterministically if the final lap needs another item.
 */
export const getAthleticsQuestionsPerLap = (questionPoolSize: number, requiredLaps: number) => {
  const poolSize = Math.max(1, Math.floor(questionPoolSize));
  const laps = sanitizeAthleticsCourseLaps(requiredLaps);
  return laps === 1 ? poolSize : Math.min(ATHLETICS_MAX_QUESTIONS_PER_LAP, Math.max(1, Math.ceil(poolSize / laps)));
};

export const getAthleticsTotalQuestionCount = (questionPoolSize: number, requiredLaps: number) =>
  getAthleticsQuestionsPerLap(questionPoolSize, requiredLaps) * sanitizeAthleticsCourseLaps(requiredLaps);

export const getAthleticsQuestionPoolIndex = (questionIndex: number, questionPoolSize: number) =>
  Math.max(0, Math.floor(questionIndex)) % Math.max(1, Math.floor(questionPoolSize));

export const getAthleticsQuestionIndexInLap = (questionIndex: number, questionsPerLap: number) =>
  Math.max(0, Math.floor(questionIndex)) % Math.max(1, Math.floor(questionsPerLap));

export type AthleticsObstacle =
  | { id: string; kind: "rect"; x: number; z: number; width: number; depth: number; rotationY?: number; jumpable?: boolean; minY?: number; maxY?: number; stair?: boolean }
  | { id: string; kind: "circle"; x: number; z: number; radius: number; jumpable?: boolean; minY?: number; maxY?: number };

const surfaceToObstacle = (surface: AthleticsCourseSurface): AthleticsObstacle => {
  const topY = Math.max(0, surface.y);
  const slabHeight = topY <= 0 ? ATHLETICS_GROUND_SURFACE_SLAB_HEIGHT : ATHLETICS_SURFACE_SLAB_HEIGHT;
  return {
    id: surface.id,
    kind: "rect",
    x: surface.x,
    z: surface.z,
    width: surface.width,
    depth: surface.depth,
    rotationY: surface.rotationY,
    jumpable: true,
    // Keep the collision volume aligned with the rendered slab. Elevated
    // switchbacks must remain passable underneath; modeling them from y=0
    // turns a high platform into a solid tower around the ground spawn.
    minY: Math.max(0, topY - slabHeight),
    maxY: topY,
    stair: surface.kind === "stair"
  };
};

const dynamicObstacleOffset = (obstacle: AthleticsMovingObstacle, nowMs: number) => {
  const period = Math.max(1, obstacle.periodMs);
  const phase = ((safeNumber(obstacle.phaseMs) + nowMs) / period) * Math.PI * 2;
  return Math.sin(phase) * obstacle.amplitude;
};

export const getAthleticsMovingObstaclePosition = (obstacle: AthleticsMovingObstacle, nowMs = Date.now()) => {
  const offset = dynamicObstacleOffset(obstacle, nowMs);
  return {
    x: obstacle.x + (obstacle.axis === "x" ? offset : 0),
    y: obstacle.y + (obstacle.axis === "y" ? offset : 0),
    z: obstacle.z + (obstacle.axis === "z" ? offset : 0)
  };
};

const isPointInsideAthleticsRect = (
  point: Pick<ArenaPosition, "x" | "z">,
  obstacle: Extract<AthleticsObstacle, { kind: "rect" }>,
  padding = 0
) => {
  const angle = obstacle.rotationY ?? 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const offsetX = point.x - obstacle.x;
  const offsetZ = point.z - obstacle.z;
  const localX = cosine * offsetX - sine * offsetZ;
  const localZ = sine * offsetX + cosine * offsetZ;
  return Math.abs(localX) <= obstacle.width / 2 + padding
    && Math.abs(localZ) <= obstacle.depth / 2 + padding;
};

/**
 * Finds the walkable floor below/at the player's current eye height. The
 * server uses this to keep elevated movement bounded without trusting a
 * client-provided y value, while the client uses the same authored boxes for
 * visual support.
 */
export const getAthleticsGroundHeight = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  nowMs = Date.now()
) => {
  const footY = Number.isFinite(position.y) ? Number(position.y) - ATHLETICS_PLAYER_EYE_HEIGHT : 0;
  let supportY = 0;
  for (const obstacle of getAthleticsObstacles(nowMs)) {
    if (obstacle.kind !== "rect") continue;
    if (!isPointInsideAthleticsRect(position, obstacle, 0.45)) continue;
    const topY = Number(obstacle.maxY ?? 0);
    if (topY <= footY + 1.05 && topY > supportY) supportY = topY;
  }
  return supportY;
};

/** Progress at the centre of an authored main-route landing. */
export const getAthleticsSurfaceRouteProgress = (
  surfaceIndex: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => routeProgressAtIndex(course.route, Math.max(0, Math.min(course.route.length - 1, Math.floor(surfaceIndex))));

/**
 * Returns the last stable main-route landing at or before a progress value.
 * Shortcut surfaces and moving obstacles are intentionally not candidates.
 */
export const getAthleticsPreviousSafeSurfaceIndex = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const safeProgress = clamp01(progress);
  let candidate = 0;
  course.surfaces.forEach((surface, index) => {
    if (getAthleticsSurfaceRouteProgress(index, course) <= safeProgress + 0.002) candidate = index;
  });
  return candidate;
};

/**
 * Finds a stable authored landing under a racer. This helper only
 * considers main-route slabs with a generous interior margin, so a fall near
 * a shortcut or a moving hazard cannot make that surface the recovery target.
 */
export const getAthleticsSurfaceIndexAtPosition = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE,
  eyeHeight = ATHLETICS_PLAYER_EYE_HEIGHT
) => {
  if (!Number.isFinite(position.y)) return undefined;
  const footY = Number(position.y) - eyeHeight;
  let best: { index: number; distance: number } | undefined;
  course.surfaces.forEach((surface, index) => {
    const obstacle = surfaceToObstacle(surface);
    if (obstacle.kind !== "rect") return;
    if (!isPointInsideAthleticsRect(position, obstacle, -0.85)) return;
    const verticalDistance = Math.abs(footY - surface.y);
    if (verticalDistance > 1.25) return;
    const distance = Math.hypot(position.x - surface.x, position.z - surface.z, verticalDistance * 1.5);
    if (!best || distance < best.distance) best = { index, distance };
  });
  return best?.index;
};

const movingObstacleToObstacle = (obstacle: AthleticsMovingObstacle, nowMs: number): AthleticsObstacle => {
  const position = getAthleticsMovingObstaclePosition(obstacle, nowMs);
  return {
    id: obstacle.id,
    kind: "rect",
    x: position.x,
    z: position.z,
    width: obstacle.width,
    depth: obstacle.depth,
    jumpable: obstacle.jumpable ?? true,
    minY: position.y,
    maxY: position.y + obstacle.height
  };
};

const parkBoundaryObstacles: readonly AthleticsObstacle[] = [
  { id: "park-west-boundary", kind: "rect", x: -140, z: 0, width: 4, depth: 276, minY: 0, maxY: 18 },
  { id: "park-east-boundary", kind: "rect", x: 140, z: 0, width: 4, depth: 276, minY: 0, maxY: 18 },
  { id: "park-north-boundary", kind: "rect", x: 0, z: 140, width: 276, depth: 4, minY: 0, maxY: 18 },
  { id: "park-south-boundary", kind: "rect", x: 0, z: -140, width: 276, depth: 4, minY: 0, maxY: 18 }
];

const ATHLETICS_ALL_SURFACES: readonly AthleticsCourseSurface[] = [
  ...ATHLETICS_SURFACES,
  ...ATHLETICS_SHORTCUTS.flatMap((shortcut) => shortcut.surfaces)
];

/** Static collision proxies shared by server movement and the client scene. */
export const ATHLETICS_COLLISION_PROXIES: readonly AthleticsObstacle[] = [
  ...parkBoundaryObstacles,
  ...ATHLETICS_ALL_SURFACES.map(surfaceToObstacle)
];

/** Collision includes the same deterministic moving transforms used by the renderer. */
export const getAthleticsObstacles = (nowMs = Date.now()): AthleticsObstacle[] => [
  ...ATHLETICS_COLLISION_PROXIES.map((obstacle) => ({ ...obstacle })),
  ...ATHLETICS_MOVING_OBSTACLES.map((obstacle) => movingObstacleToObstacle(obstacle, nowMs))
];

export interface AthleticsPhysicalSupport {
  kind: AthleticsPhysicalSupportKind;
  supportY: number;
  surfaceIndex?: number;
  surfaceId?: string;
  obstacleId?: string;
}

type AthleticsSupportCandidate = AthleticsPhysicalSupport & {
  verticalDistance: number;
  horizontalDistance: number;
  priority: number;
};

const chooseAthleticsSupport = (candidates: AthleticsSupportCandidate[]) => {
  if (candidates.length === 0) return { kind: "airborne", supportY: 0 } satisfies AthleticsPhysicalSupport;
  candidates.sort((left, right) => {
    const distance = left.verticalDistance * 2 + left.horizontalDistance * 0.01
      - (right.verticalDistance * 2 + right.horizontalDistance * 0.01);
    return Math.abs(distance) > 0.001 ? distance : left.priority - right.priority;
  });
  const { verticalDistance: _verticalDistance, horizontalDistance: _horizontalDistance, priority: _priority, ...support } = candidates[0]!;
  return support;
};

/**
 * Classifies the surface physically under the player at a specific time.
 *
 * Main-route and shortcut slabs use the authored interior footprint; moving
 * platforms use their deterministic time-sampled proxy; the park floor is a
 * deliberate recovery surface rather than a playable landing. Route
 * projection is intentionally absent from this helper.
 */
export const getAthleticsPhysicalSupport = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE,
  eyeHeight = ATHLETICS_PLAYER_EYE_HEIGHT,
  nowMs = Date.now()
): AthleticsPhysicalSupport => {
  if (![position.x, position.z, position.y].every((value) => Number.isFinite(value))) {
    return { kind: "airborne", supportY: 0 };
  }

  const footY = Number(position.y) - eyeHeight;
  const candidates: AthleticsSupportCandidate[] = [];
  const addSurfaceCandidate = (
    surface: AthleticsCourseSurface,
    kind: "main_surface" | "shortcut_surface",
    surfaceIndex?: number,
    priority = kind === "main_surface" ? 0 : 1
  ) => {
    const obstacle = surfaceToObstacle(surface);
    if (obstacle.kind !== "rect" || !isPointInsideAthleticsRect(position, obstacle, -0.85)) return;
    const verticalDistance = Math.abs(footY - surface.y);
    if (verticalDistance > 1.25) return;
    candidates.push({
      kind,
      supportY: surface.y,
      surfaceIndex,
      surfaceId: surface.id,
      verticalDistance,
      horizontalDistance: Math.hypot(position.x - surface.x, position.z - surface.z),
      priority
    });
  };

  course.surfaces.forEach((surface, index) => addSurfaceCandidate(surface, "main_surface", index));
  for (const shortcut of course.shortcuts) {
    for (const surface of shortcut.surfaces) addSurfaceCandidate(surface, "shortcut_surface");
  }

  for (const moving of course.movingObstacles) {
    if (moving.kind === "barrier" || moving.jumpable === false) continue;
    const obstacle = movingObstacleToObstacle(moving, nowMs);
    if (obstacle.kind !== "rect" || !isPointInsideAthleticsRect(position, obstacle, -0.85)) continue;
    const supportY = Number(obstacle.maxY ?? 0);
    const verticalDistance = Math.abs(footY - supportY);
    if (verticalDistance > 1.25) continue;
    candidates.push({
      kind: "moving_platform",
      supportY,
      obstacleId: moving.id,
      verticalDistance,
      horizontalDistance: Math.hypot(position.x - obstacle.x, position.z - obstacle.z),
      priority: 2
    });
  }

  const insideParkFloor = Math.abs(position.x) <= course.bounds.limitX - 2
    && Math.abs(position.z) <= course.bounds.limitZ - 2;
  const floorDistance = Math.abs(footY);
  if (insideParkFloor && floorDistance <= 1.25) {
    candidates.push({
      kind: "park_floor",
      supportY: 0,
      verticalDistance: floorDistance,
      horizontalDistance: Math.hypot(position.x, position.z),
      priority: 3
    });
  }

  return chooseAthleticsSupport(candidates);
};

export const getAthleticsCheckpointProgress = (checkpointIndex: number, checkpointCount: number) =>
  checkpointCount <= 0 ? 1 : clamp01(checkpointIndex / checkpointCount);

/** Returns the authored main-route landing that physically represents a checkpoint. */
export const getAthleticsCheckpointSurfaceIndex = (
  checkpointIndex: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const checkpoint = course.checkpoints[Math.max(0, Math.floor(checkpointIndex))];
  if (checkpoint === undefined) return undefined;
  let bestIndex: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  course.surfaces.forEach((_, index) => {
    const distance = Math.abs(getAthleticsSurfaceRouteProgress(index, course) - checkpoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};

/** Progress of a reached checkpoint on the authored main route. */
export const getAthleticsCheckpointRouteProgress = (
  checkpointIndex: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const reached = Math.max(0, Math.floor(checkpointIndex));
  if (reached <= 0) return 0;
  return course.checkpoints[Math.min(reached, course.checkpoints.length) - 1] ?? 1;
};

/** Compatibility helper for older HUD/tests; course movement no longer calls this as a gate. */
export const getAthleticsNextGateProgress = (player: Pick<AthleticsPlayerState, "checkpointIndex" | "questionIndex">, questionCount: number) =>
  player.questionIndex >= questionCount
    ? 1
    : getAthleticsCheckpointProgress(Math.max(1, player.checkpointIndex + 1), questionCount);

export const getAthleticsPointAtProgress = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
): Readonly<AthleticsRoutePoint> => routePointAtProgressUnchecked(progress, course.route);

export const getAthleticsRouteHeight = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => getAthleticsPointAtProgress(progress, course).y;

export const isAthleticsBelowRecoverableRoute = (
  position: { y?: number },
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => Number.isFinite(position.y)
  && Number(position.y) < getAthleticsRouteHeight(progress, course)
    + ATHLETICS_PLAYER_EYE_HEIGHT
    - ATHLETICS_MAX_RECOVERABLE_ROUTE_DROP;

export const getAthleticsRouteTangent = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const point = getAthleticsPointAtProgress(progress, course);
  const ahead = getAthleticsPointAtProgress(Math.min(1, progress + 0.002), course);
  const length = Math.hypot(ahead.x - point.x, ahead.z - point.z) || 1;
  return { x: (ahead.x - point.x) / length, z: (ahead.z - point.z) / length };
};

type AthleticsRouteProjection = {
  progress: number;
  distance: number;
  routeWidth: number;
};

const projectAthleticsRoute = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  route: readonly AthleticsRoutePoint[],
  startProgress: number,
  endProgress: number,
  routeWidth: number
): AthleticsRouteProjection => {
  const { lengths, total } = routeLengths({ route });
  const useVerticalProjection = Number.isFinite(position.y);
  let distanceBefore = 0;
  let bestProgress = startProgress;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lengths.length; index += 1) {
    const start = route[index]!;
    const end = route[index + 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz + (useVerticalProjection ? dy * dy : 0) || 1;
    const projected = (
      (position.x - start.x) * dx
      + (position.z - start.z) * dz
      + (useVerticalProjection ? (Number(position.y) - start.y) * dy : 0)
    ) / lengthSquared;
    const part = Math.min(1, Math.max(0, projected));
    const nearestX = start.x + dx * part;
    const nearestY = start.y + dy * part;
    const nearestZ = start.z + dz * part;
    const distance = Math.hypot(position.x - nearestX, position.z - nearestZ, ...(useVerticalProjection ? [Number(position.y) - nearestY] : []));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = startProgress + ((distanceBefore + lengths[index]! * part) / total) * (endProgress - startProgress);
    }
    distanceBefore += lengths[index]!;
  }
  if (!Number.isFinite(bestDistance)) {
    const point = route[0] ?? { x: 0, y: 0, z: 0 };
    bestDistance = Number.isFinite(position.y)
      ? Math.hypot(position.x - point.x, Number(position.y) - point.y, position.z - point.z)
      : Math.hypot(position.x - point.x, position.z - point.z);
  }
  return { progress: clamp01(bestProgress), distance: bestDistance, routeWidth };
};

const getAthleticsRouteProjection = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition
) => {
  let best = projectAthleticsRoute(position, course.route, 0, 1, course.routeWidth);
  for (const shortcut of course.shortcuts) {
    const candidate = projectAthleticsRoute(
      position,
      shortcut.route,
      shortcut.startProgress,
      shortcut.endProgress,
      shortcut.routeWidth ?? course.routeWidth
    );
    if (candidate.distance < best.distance) best = candidate;
  }
  return best;
};

export const getAthleticsRouteLength = (
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => routeLengths(course).total;

export const getAthleticsRouteProgress = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => getAthleticsRouteProjection(position, course).progress;

export const getAthleticsRouteDistance = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => getAthleticsRouteProjection(position, course).distance;

export const isAthleticsOnRoute = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const projection = getAthleticsRouteProjection(position, course);
  return projection.distance <= projection.routeWidth;
};

export const getAthleticsStartPosition = (
  laneIndex = 0,
  totalPlayers = 1,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const tangent = getAthleticsRouteTangent(0, course);
  const normal = { x: -tangent.z, z: tangent.x };
  const laneCount = Math.max(1, Math.min(8, totalPlayers));
  const laneColumn = Math.max(0, Math.floor(laneIndex)) % laneCount;
  const laneRow = Math.floor(Math.max(0, Math.floor(laneIndex)) / laneCount);
  const centeredLane = laneColumn - (laneCount - 1) / 2;
  const start = getAthleticsPointAtProgress(0, course);
  return {
    x: start.x + normal.x * centeredLane * 1.8 - tangent.x * laneRow * 1.6,
    y: start.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: start.z + normal.z * centeredLane * 1.8 - tangent.z * laneRow * 1.6,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

export const getAthleticsCheckpointPosition = (
  checkpointIndex: number,
  checkpointCount = ATHLETICS_CHECKPOINT_COUNT,
  laneOffset = 0,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const progress = checkpointCount === course.checkpoints.length
    ? getAthleticsCheckpointRouteProgress(checkpointIndex, course)
    : getAthleticsCheckpointProgress(checkpointIndex, checkpointCount);
  const point = getAthleticsPointAtProgress(progress, course);
  const tangent = getAthleticsRouteTangent(progress, course);
  const normal = { x: -tangent.z, z: tangent.x };
  return {
    x: point.x + normal.x * laneOffset,
    y: point.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: point.z + normal.z * laneOffset,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

export const getAthleticsRespawnPosition = (
  checkpointIndex: number,
  checkpointCount = ATHLETICS_CHECKPOINT_COUNT,
  laneIndex = 0,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const checkpointProgress = checkpointCount === course.checkpoints.length
    ? getAthleticsCheckpointRouteProgress(checkpointIndex, course)
    : getAthleticsCheckpointProgress(checkpointIndex, checkpointCount);
  const progress = Math.max(0, checkpointProgress - 0.014);
  const point = getAthleticsPointAtProgress(progress, course);
  const tangent = getAthleticsRouteTangent(progress, course);
  const normal = { x: -tangent.z, z: tangent.x };
  const laneOffset = (Math.max(0, laneIndex) % 5 - 2) * 1.3;
  return {
    x: point.x + normal.x * laneOffset,
    y: point.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: point.z + normal.z * laneOffset,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

/**
 * Safe, interior respawn on the last authored main-route landing. The lane
 * offset is clamped away from every edge and the facing points at the next
 * main-route jump rather than back toward the failed section.
 */
export const getAthleticsRecoveryPosition = (
  surfaceIndex: number,
  laneIndex = 0,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const safeIndex = Math.max(0, Math.min(course.surfaces.length - 1, Math.floor(surfaceIndex)));
  const surface = course.surfaces[safeIndex] ?? course.surfaces[0]!;
  const progress = getAthleticsSurfaceRouteProgress(safeIndex, course);
  const tangent = getAthleticsRouteTangent(Math.min(1, progress + 0.004), course);
  const normal = { x: -tangent.z, z: tangent.x };
  const laneSlot = (Math.max(0, Math.floor(laneIndex)) % 3) - 1;
  const safeOffset = Math.max(0, Math.min(surface.width, surface.depth) / 2 - 2.25);
  const laneOffset = Math.max(-safeOffset, Math.min(safeOffset, laneSlot * 1.15));
  return {
    x: surface.x + normal.x * laneOffset,
    y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: surface.z + normal.z * laneOffset,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

/** New course finish predicate: reaching the summit is never gated by question count. */
export const isAthleticsCourseFinish = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => getAthleticsRouteProgress(position, course) >= course.finishThreshold
  && getAthleticsRouteDistance(position, course) <= course.routeWidth + 4;

/** Compatibility predicate retained for older consumers and fixtures. */
export const isAthleticsFinish = (
  position: Pick<ArenaPosition, "x" | "z">,
  questionIndex: number,
  questionCount: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => questionCount > 0 && questionIndex >= questionCount && isAthleticsCourseFinish(position, course);

export interface AthleticsStanding {
  playerId: string;
  rank: number;
  status: AthleticsPlayerStatus;
  completedLaps: number;
  questionIndex: number;
  checkpointIndex: number;
  routeProgress: number;
  finishTimeMs?: number;
}

export const resolveAthleticsStandings = (
  players: Array<Pick<PlayerSession, "id" | "isBot" | "connectionState" | "athletics">>
): AthleticsStanding[] => {
  const sorted = players
    .filter((player) => player.athletics)
    .map((player) => ({
      playerId: player.id,
      status: player.athletics!.status,
      completedLaps: player.athletics!.completedLaps ?? 0,
      questionIndex: player.athletics!.questionIndex,
      checkpointIndex: player.athletics!.checkpointIndex,
      routeProgress: player.athletics!.routeProgress,
      finishTimeMs: player.athletics!.finishTimeMs,
      isBot: player.isBot === true,
      disconnected: player.connectionState === "disconnected"
    }))
    .sort((left, right) => {
      const statusRank = (status: AthleticsPlayerStatus, disconnected: boolean) =>
        status === "finished" ? 0 : status === "racing" && !disconnected ? 1 : 2;
      const statusDifference = statusRank(left.status, left.disconnected) - statusRank(right.status, right.disconnected);
      if (statusDifference !== 0) return statusDifference;
      if (left.status === "finished" && right.status === "finished") {
        return (left.finishTimeMs ?? Number.POSITIVE_INFINITY) - (right.finishTimeMs ?? Number.POSITIVE_INFINITY);
      }
      return right.completedLaps - left.completedLaps
        || right.checkpointIndex - left.checkpointIndex
        || right.routeProgress - left.routeProgress
        || right.questionIndex - left.questionIndex
        || Number(left.isBot) - Number(right.isBot)
        || left.playerId.localeCompare(right.playerId);
    });

  return sorted.map((entry, index) => ({
    playerId: entry.playerId,
    rank: index + 1,
    status: entry.status,
    completedLaps: entry.completedLaps,
    questionIndex: entry.questionIndex,
    checkpointIndex: entry.checkpointIndex,
    routeProgress: entry.routeProgress,
    ...(entry.finishTimeMs === undefined ? {} : { finishTimeMs: entry.finishTimeMs })
  }));
};

export const normalizeAthleticsEnergy = (value: unknown) =>
  Math.min(ATHLETICS_MAX_ENERGY, Math.max(0, safeNumber(value)));

export const awardAthleticsEnergy = ({ isCorrect, currentEnergy }: { isCorrect: boolean; currentEnergy: number | undefined }) => {
  const safeEnergy = normalizeAthleticsEnergy(currentEnergy);
  return isCorrect
    ? Math.min(ATHLETICS_MAX_ENERGY, safeEnergy + ATHLETICS_CORRECT_ENERGY)
    : safeEnergy;
};

export interface AthleticsEnergyResolution {
  canMove: boolean;
  nextEnergy: number;
  movementCost: number;
  jumpCost: number;
}

export const resolveAthleticsMovementEnergy = ({
  currentEnergy,
  elapsedMs,
  movedDistance,
  jumped
}: {
  currentEnergy: number | undefined;
  elapsedMs: number;
  movedDistance: number;
  jumped: boolean;
}): AthleticsEnergyResolution => {
  const safeEnergy = normalizeAthleticsEnergy(currentEnergy);
  const movementCost = movedDistance > 0.05
    ? Math.max(0, Math.min(0.65, Math.max(0, elapsedMs) / 1000)) * ATHLETICS_MOVEMENT_DRAIN_PER_SECOND
    : 0;
  const jumpCost = jumped ? ATHLETICS_JUMP_ENERGY_COST : 0;
  const nextEnergy = Math.max(0, safeEnergy - movementCost - jumpCost);
  return {
    canMove: safeEnergy > 0,
    nextEnergy,
    movementCost,
    jumpCost
  };
};
