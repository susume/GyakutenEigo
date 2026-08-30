import type { ArenaPosition, PlayerSession } from "./index.js";

export type AthleticsCourseId = "stadium_loop";

export type AthleticsRaceStatus = "countdown" | "running" | "finished" | "expired";
export type AthleticsPlayerStatus = "racing" | "finished" | "dnf";

export interface AthleticsRaceState {
  courseId: AthleticsCourseId;
  /** Number of question credits available on every lap. Questions are fuel, not gates. */
  questionsPerLap: number;
  /** Total correct answers that can be earned from the configured question pool. */
  questionCount: number;
  requiredLaps: number;
  status: AthleticsRaceStatus;
  /** Official GO timestamp. Before this instant the course is locked. */
  startAt: string;
  finishOrder: string[];
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
export const ATHLETICS_WALK_DRAIN_PER_SECOND = 2.2;
export const ATHLETICS_RUN_DRAIN_PER_SECOND = 6.4;
export const ATHLETICS_JUMP_ENERGY_COST = 30;
export const ATHLETICS_CRITICAL_ENERGY = 150;

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

const routeNormalAtProgress = (progress: number, route: readonly AthleticsRoutePoint[]) => {
  const point = routePointAtProgressUnchecked(progress, route);
  const ahead = routePointAtProgressUnchecked(Math.min(1, progress + 0.002), route);
  const length = Math.hypot(ahead.x - point.x, ahead.z - point.z) || 1;
  return { x: -(ahead.z - point.z) / length, z: (ahead.x - point.x) / length };
};

/**
 * Six dense, hand-authored parkour chapters climb through the park. The route
 * revisits a few attraction sightlines at different heights, so projection
 * uses y when the caller supplies it and cannot turn a visual crossing into a
 * ranking shortcut.
 */
const ATHLETICS_ROUTE: readonly AthleticsRoutePoint[] = [
  // Park Entrance: 0-10
  { x: 0, z: 123, y: 0 },
  { x: -8, z: 109, y: 1 },
  { x: 10, z: 96, y: 3 },
  { x: -3, z: 83, y: 5 },
  { x: 13, z: 69, y: 7 },
  { x: 0, z: 56, y: 9 },
  { x: 17, z: 43, y: 11 },
  { x: 4, z: 31, y: 13 },
  { x: -13, z: 19, y: 15 },
  { x: 0, z: 8, y: 17 },
  { x: -19, z: -8, y: 19 },
  // Midway Mayhem: 11-21
  { x: -33, z: -21, y: 21 },
  { x: -17, z: -35, y: 23 },
  { x: 2, z: -29, y: 25 },
  { x: 19, z: -40, y: 27 },
  { x: 33, z: -56, y: 29 },
  { x: 15, z: -69, y: 31 },
  { x: -6, z: -61, y: 33 },
  { x: -23, z: -75, y: 35 },
  { x: -42, z: -63, y: 37 },
  { x: -52, z: -48, y: 39 },
  // Ride District: 22-32
  { x: -38, z: -33, y: 41 },
  { x: -21, z: -19, y: 43 },
  { x: -4, z: -29, y: 45 },
  { x: 15, z: -17, y: 47 },
  { x: 33, z: -4, y: 49 },
  { x: 50, z: 10, y: 51 },
  { x: 40, z: 27, y: 53 },
  { x: 23, z: 38, y: 55 },
  { x: 4, z: 31, y: 57 },
  { x: -13, z: 44, y: 59 },
  { x: -29, z: 60, y: 61 },
  // Ferris & Coaster: 33-43
  { x: -48, z: 48, y: 63 },
  { x: -63, z: 35, y: 65 },
  { x: -79, z: 19, y: 67 },
  { x: -69, z: 2, y: 69 },
  { x: -84, z: -13, y: 71 },
  { x: -100, z: 0, y: 73 },
  { x: -88, z: 19, y: 75 },
  { x: -71, z: 33, y: 77 },
  { x: -54, z: 21, y: 79 },
  { x: -38, z: 6, y: 81 },
  { x: -21, z: -8, y: 83 },
  // Drop Tower: 44-54
  { x: -4, z: -23, y: 85 },
  { x: 13, z: -36, y: 86.5 },
  { x: 31, z: -25, y: 88 },
  { x: 46, z: -40, y: 89.5 },
  { x: 61, z: -56, y: 91 },
  { x: 48, z: -73, y: 92.5 },
  { x: 29, z: -84, y: 94 },
  { x: 10, z: -75, y: 95.5 },
  { x: -8, z: -90, y: 97 },
  { x: -27, z: -104, y: 98.5 },
  { x: -46, z: -92, y: 100 },
  // Sky Park Summit: 55-64
  { x: -61, z: -108, y: 101 },
  { x: -81, z: -94, y: 102 },
  { x: -98, z: -109, y: 103 },
  { x: -113, z: -94, y: 104 },
  { x: -104, z: -75, y: 105 },
  { x: -84, z: -65, y: 106 },
  { x: -65, z: -77, y: 107 },
  { x: -46, z: -61, y: 108 },
  { x: -27, z: -73, y: 109 },
  { x: -8, z: -58, y: 109.5 },
  { x: 13, z: -44, y: 110 }
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
  sectionAt(0, 10, "park-entrance", "Park Entrance", "Learn the jump rhythm on wide ticket-plaza landings.", "cyan", "Grand entrance"),
  sectionAt(10, 21, "midway-mayhem", "Midway Mayhem", "Thread awnings and stalls while the gaps start to tighten.", "orange", "Food stalls"),
  sectionAt(21, 32, "ride-district", "Ride District", "Use the ride decks and a moving lift to gain the skyline.", "lime", "Ride decks"),
  sectionAt(32, 43, "ferris-coaster", "Ferris & Coaster", "Make the hero jump from the Ferris deck to the coaster maintenance line.", "gold", "Ferris wheel and coaster"),
  sectionAt(43, 54, "drop-tower", "Drop Tower", "Climb the tower service line with forgiving, readable landings.", "violet", "Drop tower"),
  sectionAt(54, 64, "sky-park-summit", "Sky Park Summit", "Cross the final rooftop chain and finish above the whole park.", "pink", "Summit flags")
];

type AuthoredSurfaceSpec = Pick<AthleticsCourseSurface, "kind" | "width" | "depth" | "safe" | "material">;

/** Explicit surface tuning; there is no modulo-based sampling or auto-fill. */
const ATHLETICS_SURFACE_SPECS: readonly AuthoredSurfaceSpec[] = [
  // Park Entrance: wide, forgiving teaching landings.
  { kind: "platform", width: 28, depth: 22, safe: true, material: "stone" },
  { kind: "platform", width: 21, depth: 17, safe: false, material: "stone" },
  { kind: "platform", width: 20, depth: 17, safe: false, material: "stone" },
  { kind: "platform", width: 19, depth: 16, safe: false, material: "accent" },
  { kind: "stair", width: 21, depth: 15, safe: true, material: "accent" },
  { kind: "platform", width: 19, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 20, depth: 16, safe: false, material: "accent" },
  { kind: "ramp", width: 21, depth: 17, safe: false, material: "accent" },
  { kind: "platform", width: 19, depth: 16, safe: false, material: "metal" },
  { kind: "platform", width: 21, depth: 17, safe: false, material: "metal" },
  { kind: "checkpoint", width: 28, depth: 22, safe: true, material: "accent" },
  // Midway Mayhem.
  { kind: "platform", width: 20, depth: 16, safe: false, material: "wood" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "wood" },
  { kind: "platform", width: 19, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 22, depth: 17, safe: true, material: "wood" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "wood" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "wood" },
  { kind: "ramp", width: 20, depth: 15, safe: false, material: "wood" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 20, depth: 16, safe: false, material: "wood" },
  { kind: "checkpoint", width: 28, depth: 22, safe: true, material: "accent" },
  // Ride District.
  { kind: "platform", width: 19, depth: 16, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 20, depth: 15, safe: true, material: "metal" },
  { kind: "platform", width: 19, depth: 15, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "ramp", width: 21, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 19, depth: 15, safe: false, material: "accent" },
  { kind: "platform", width: 20, depth: 16, safe: false, material: "metal" },
  { kind: "checkpoint", width: 28, depth: 22, safe: true, material: "accent" },
  // Ferris & Coaster.
  { kind: "platform", width: 20, depth: 16, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 20, depth: 16, safe: true, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "ramp", width: 21, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 19, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 20, depth: 15, safe: true, material: "metal" },
  { kind: "platform", width: 19, depth: 16, safe: false, material: "accent" },
  { kind: "checkpoint", width: 28, depth: 22, safe: true, material: "accent" },
  // Drop Tower.
  { kind: "platform", width: 20, depth: 16, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "ramp", width: 20, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 20, depth: 16, safe: true, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 19, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "stair", width: 20, depth: 16, safe: true, material: "metal" },
  { kind: "checkpoint", width: 28, depth: 22, safe: true, material: "accent" },
  // Sky Park Summit.
  { kind: "platform", width: 20, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "accent" },
  { kind: "stair", width: 20, depth: 16, safe: true, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "ramp", width: 21, depth: 16, safe: false, material: "accent" },
  { kind: "platform", width: 18, depth: 15, safe: false, material: "metal" },
  { kind: "platform", width: 19, depth: 15, safe: false, material: "accent" },
  { kind: "platform", width: 20, depth: 16, safe: false, material: "metal" },
  { kind: "checkpoint", width: 30, depth: 24, safe: true, material: "accent" }
];

const makeAuthoredSurfaces = (route: readonly AthleticsRoutePoint[], specs: readonly AuthoredSurfaceSpec[]) => {
  if (route.length !== specs.length) throw new Error(`Athletics route/surface authoring mismatch: ${route.length} route points, ${specs.length} specs`);
  return route.map((point, index) => ({
    ...specs[index]!,
    id: `route-platform-${String(index + 1).padStart(3, "0")}`,
    x: point.x,
    z: point.z,
    y: point.y
  } satisfies AthleticsCourseSurface));
};

const ATHLETICS_SURFACES = makeAuthoredSurfaces(ATHLETICS_ROUTE, ATHLETICS_SURFACE_SPECS);
const ATHLETICS_CHECKPOINTS = [10, 21, 32, 43, 54, 64].map((index) => routeProgressAtIndex(ATHLETICS_ROUTE, index));

const shortcutSurface = (
  id: string,
  kind: AthleticsSurfaceKind,
  x: number,
  z: number,
  y: number,
  width: number,
  depth: number,
  material: AthleticsCourseSurface["material"] = "accent"
): AthleticsCourseSurface => ({ id, kind, x, z, y, width, depth, safe: false, material });

const ATHLETICS_SHORTCUTS: readonly AthleticsCourseShortcut[] = [
  {
    id: "midway-service-cut",
    label: "Midway service cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 12),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 16),
    route: [ATHLETICS_ROUTE[12]!, { x: -1, z: -48, y: 26 }, ATHLETICS_ROUTE[16]!],
    surfaces: [shortcutSurface("shortcut-midway-service-01", "platform", -1, -48, 26, 17, 13, "wood")],
    routeWidth: 12
  },
  {
    id: "ferris-maintenance-cut",
    label: "Ferris maintenance cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 34),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 39),
    route: [
      ATHLETICS_ROUTE[34]!,
      { x: -82, z: 45, y: 68 },
      { x: -101, z: 30, y: 71 },
      { x: -108, z: 9, y: 73 },
      ATHLETICS_ROUTE[39]!
    ],
    surfaces: [
      shortcutSurface("shortcut-ferris-maintenance-01", "platform", -82, 45, 68, 16, 13, "metal"),
      shortcutSurface("shortcut-ferris-maintenance-02", "stair", -101, 30, 71, 17, 13, "accent"),
      shortcutSurface("shortcut-ferris-maintenance-03", "platform", -108, 9, 73, 16, 13, "metal")
    ],
    routeWidth: 12
  },
  {
    id: "drop-tower-rooftop-cut",
    label: "Drop tower rooftop cut",
    startProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 47),
    endProgress: routeProgressAtIndex(ATHLETICS_ROUTE, 52),
    route: [
      ATHLETICS_ROUTE[47]!,
      { x: 79, z: -70, y: 93 },
      { x: 61, z: -91, y: 96 },
      { x: 24, z: -101, y: 98 },
      ATHLETICS_ROUTE[52]!
    ],
    surfaces: [
      shortcutSurface("shortcut-drop-rooftop-01", "platform", 79, -70, 93, 17, 13, "accent"),
      shortcutSurface("shortcut-drop-rooftop-02", "ramp", 61, -91, 96, 18, 13, "metal"),
      shortcutSurface("shortcut-drop-rooftop-03", "platform", 24, -101, 98, 17, 13, "accent")
    ],
    routeWidth: 12
  }
];

const ATHLETICS_MOVING_OBSTACLES: readonly AthleticsMovingObstacle[] = [
  { id: "midway-swing-platform", kind: "platform", x: 20, z: -49, y: 27.5, width: 15, depth: 13, height: 1.2, axis: "x", amplitude: 7, periodMs: 4200, phaseMs: 300, material: "wood", jumpable: true },
  { id: "ride-district-lift", kind: "elevator", x: 41, z: 24, y: 50, width: 16, depth: 13, height: 1.2, axis: "y", amplitude: 5, periodMs: 5600, phaseMs: 900, material: "metal", jumpable: true },
  { id: "ferris-gondola-crossing", kind: "barrier", x: -79, z: 17, y: 68, width: 14, depth: 4, height: 1.4, axis: "z", amplitude: 7, periodMs: 3900, phaseMs: 1100, material: "accent", jumpable: true },
  { id: "coaster-maintenance-cart", kind: "barrier", x: -56, z: 13, y: 78.5, width: 13, depth: 4, height: 1.4, axis: "x", amplitude: 8, periodMs: 4700, phaseMs: 1500, material: "metal", jumpable: true },
  { id: "drop-tower-lift", kind: "elevator", x: 45, z: -52, y: 90, width: 16, depth: 13, height: 1.2, axis: "y", amplitude: 5.5, periodMs: 6000, phaseMs: 200, material: "metal", jumpable: true },
  { id: "summit-crossing-platform", kind: "platform", x: -59, z: -72, y: 106, width: 17, depth: 13, height: 1.2, axis: "z", amplitude: 6, periodMs: 5100, phaseMs: 700, material: "accent", jumpable: true }
];

export const ATHLETICS_STADIUM_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop",
  title: "Skyline Adventure Park",
  subtitle: "Answer for energy. Jump the attractions. Reach the summit.",
  route: ATHLETICS_ROUTE,
  sections: ATHLETICS_SECTIONS,
  checkpoints: ATHLETICS_CHECKPOINTS,
  surfaces: ATHLETICS_SURFACES,
  shortcuts: ATHLETICS_SHORTCUTS,
  movingObstacles: ATHLETICS_MOVING_OBSTACLES,
  routeWidth: 14,
  finishThreshold: 0.982,
  bounds: ATHLETICS_COURSE_BOUNDS
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
  | { id: string; kind: "rect"; x: number; z: number; width: number; depth: number; jumpable?: boolean; minY?: number; maxY?: number; stair?: boolean }
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
    if (Math.abs(position.x - obstacle.x) > obstacle.width / 2 + 0.45) continue;
    if (Math.abs(position.z - obstacle.z) > obstacle.depth / 2 + 0.45) continue;
    const topY = Number(obstacle.maxY ?? 0);
    if (topY <= footY + 1.05 && topY > supportY) supportY = topY;
  }
  return supportY;
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

export const getAthleticsCheckpointProgress = (checkpointIndex: number, checkpointCount: number) =>
  checkpointCount <= 0 ? 1 : clamp01(checkpointIndex / checkpointCount);

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
  sprinting,
  jumped
}: {
  currentEnergy: number | undefined;
  elapsedMs: number;
  movedDistance: number;
  sprinting: boolean;
  jumped: boolean;
}): AthleticsEnergyResolution => {
  const safeEnergy = normalizeAthleticsEnergy(currentEnergy);
  const movementCost = movedDistance > 0.05
    ? Math.max(0, Math.min(0.65, Math.max(0, elapsedMs) / 1000)) * (sprinting ? ATHLETICS_RUN_DRAIN_PER_SECOND : ATHLETICS_WALK_DRAIN_PER_SECOND)
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
