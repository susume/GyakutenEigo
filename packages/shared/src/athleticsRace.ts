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
  movingObstacles: readonly AthleticsMovingObstacle[];
  routeWidth: number;
  finishThreshold: number;
  bounds: { limitX: number; limitZ: number };
}

/** The park is intentionally much larger than the combat arenas. */
export const ATHLETICS_COURSE_BOUNDS = { limitX: 228, limitZ: 226 } as const;
export const ATHLETICS_PLAYER_EYE_HEIGHT = 4.21;
export const ATHLETICS_CHECKPOINT_COUNT = 9;

/**
 * Athletics uses its own movement economy while sharing the same safe,
 * server-owned answer validation and question history with Zombie Mode.
 */
export const ATHLETICS_MAX_ENERGY = 1000;
export const ATHLETICS_CORRECT_ENERGY = 250;
export const ATHLETICS_WALK_DRAIN_PER_SECOND = 2.2;
export const ATHLETICS_RUN_DRAIN_PER_SECOND = 7.2;
export const ATHLETICS_JUMP_ENERGY_COST = 36;
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
 * The route is a long, visible switchback through the park. It deliberately
 * revisits the same x/z neighbourhood at different y values around the
 * Ferris wheel; route projection uses y when the caller supplies it so those
 * crossings cannot become ranking shortcuts.
 */
const ATHLETICS_ROUTE: readonly AthleticsRoutePoint[] = [
  { x: 0, z: 214, y: 0 },
  { x: -28, z: 184, y: 0 },
  { x: 28, z: 152, y: 0 },
  { x: -34, z: 120, y: 0 },
  { x: 0, z: 90, y: 0 },
  { x: 70, z: 72, y: 4 },
  { x: 140, z: 66, y: 7 },
  { x: 190, z: 34, y: 10 },
  { x: 150, z: 0, y: 10 },
  { x: 95, z: -18, y: 13 },
  { x: 40, z: -45, y: 16 },
  { x: -30, z: -32, y: 19 },
  { x: -90, z: -60, y: 21 },
  { x: -160, z: -10, y: 25 },
  { x: -180, z: 45, y: 28 },
  { x: -128, z: 80, y: 32 },
  { x: -60, z: 60, y: 34 },
  { x: -10, z: 95, y: 37 },
  { x: 70, z: 100, y: 40 },
  { x: 150, z: 130, y: 43 },
  { x: 190, z: 165, y: 46 },
  { x: 140, z: 195, y: 49 },
  { x: 70, z: 178, y: 52 },
  { x: 20, z: 214, y: 56 },
  { x: -30, z: 190, y: 58 },
  { x: -80, z: 150, y: 61 },
  { x: -150, z: 170, y: 64 },
  { x: -205, z: 125, y: 67 },
  { x: -180, z: 70, y: 70 },
  { x: -120, z: 30, y: 73 },
  { x: -80, z: -20, y: 76 },
  { x: -120, z: -80, y: 80 },
  { x: -180, z: -105, y: 83 },
  { x: -140, z: -150, y: 86 },
  { x: -60, z: -175, y: 89 },
  { x: 20, z: -155, y: 92 },
  { x: 100, z: -175, y: 95 },
  { x: 155, z: -135, y: 99 },
  { x: 175, z: -70, y: 102 },
  { x: 120, z: -30, y: 106 },
  { x: 60, z: -10, y: 110 }
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
  sectionAt(0, 4, "park-entrance", "Park Entrance", "Start in the plaza, learn the rhythm, and jump the ticket line.", "cyan", "Grand entrance arch"),
  sectionAt(4, 8, "sunset-midway", "Sunset Midway", "Stalls, awnings, and bright platforms pull you above the midway.", "orange", "Carnival stalls"),
  sectionAt(8, 12, "bumper-car-arena", "Bumper-Car Arena", "Thread the padded barriers and climb the lighting rig.", "lime", "Bumper-car bowl"),
  sectionAt(12, 16, "mirror-funhouse", "Mirror Funhouse", "Bounce, zig-zag, and read the next platform through the color.", "violet", "Mirror funhouse"),
  sectionAt(16, 20, "ride-pier", "Ride Pier", "Cross the ride supports and catch the rising service platforms.", "pink", "Swing-ride pier"),
  sectionAt(20, 24, "ferris-wheel", "Ferris Wheel", "Use the wheel's maintenance decks for a dramatic skyline view.", "gold", "Ferris wheel landmark"),
  sectionAt(24, 28, "coaster-yard", "Roller-Coaster Yard", "Run trackside, take the wide turns, and keep climbing.", "cyan", "Coaster maintenance loop"),
  sectionAt(28, 32, "drop-tower", "Drop Tower", "A tall spiral of platforms turns the fall below into a view.", "orange", "Drop tower"),
  sectionAt(32, 36, "sky-park", "Sky Park", "Balloons, rooftop bridges, and open air frame the final push.", "lime", "Sky bridges"),
  sectionAt(36, 40, "finish-tower", "Finish Tower", "Make the final jumps and sprint beneath the summit flags.", "gold", "Summit finish tower")
];

const makeRouteSurfaces = (route: readonly AthleticsRoutePoint[]) => {
  const surfaces: AthleticsCourseSurface[] = [];
  const { total } = routeLengths({ route });
  // A platform every ~18 world units keeps the long route active. Every
  // third landing is deliberately shorter so a clean lap contains dozens
  // of readable jumps without turning the course into a precision platformer.
  const spacing = 18;
  let distance = 0;
  let sampleIndex = 0;
  while (distance <= total + 0.01) {
    const point = routePointAtDistance(distance, route);
    const progress = total <= 0 ? 0 : distance / total;
    const section = ATHLETICS_SECTIONS.find((candidate) => progress <= candidate.endProgress) ?? ATHLETICS_SECTIONS.at(-1)!;
    const isSafe = sampleIndex % 12 === 0 || sampleIndex === 0;
    const isGap = sampleIndex > 0 && sampleIndex % 3 === 0;
    const width = isSafe ? 25 : isGap ? 17 : 20;
    const depth = isSafe ? 24 : isGap ? 13 : 18;
    const kind: AthleticsSurfaceKind = sampleIndex % 10 === 3
      ? "checkpoint"
      : sampleIndex % 9 === 4
        ? "stair"
        : "platform";
    const tangent = routeNormalAtProgress(progress, route);
    surfaces.push({
      id: `route-platform-${String(sampleIndex + 1).padStart(3, "0")}`,
      kind,
      x: Number(point.x.toFixed(2)),
      z: Number(point.z.toFixed(2)),
      y: Number(point.y.toFixed(2)),
      width,
      depth,
      rotationY: Math.atan2(tangent.z, tangent.x) + Math.PI / 2,
      safe: isSafe,
      material: section.accent === "gold" || section.accent === "orange" ? "wood" : "metal"
    });
    sampleIndex += 1;
    distance += spacing;
  }
  return surfaces;
};

const ATHLETICS_SURFACES = makeRouteSurfaces(ATHLETICS_ROUTE);

const ATHLETICS_MOVING_OBSTACLES: readonly AthleticsMovingObstacle[] = [
  { id: "midway-sun-platform", kind: "platform", x: 118, z: 38, y: 8, width: 16, depth: 14, height: 1.2, axis: "x", amplitude: 16, periodMs: 5200, phaseMs: 300, material: "wood", jumpable: true },
  { id: "bumper-lighting-bridge", kind: "barrier", x: -8, z: -48, y: 19, width: 18, depth: 4, height: 1.2, axis: "z", amplitude: 10, periodMs: 4300, phaseMs: 1100, material: "accent", jumpable: true },
  { id: "funhouse-lift", kind: "elevator", x: -145, z: 28, y: 27, width: 18, depth: 16, height: 1.2, axis: "y", amplitude: 8, periodMs: 6200, phaseMs: 900, material: "metal", jumpable: true },
  { id: "ride-pier-ferry", kind: "platform", x: 112, z: 113, y: 42, width: 17, depth: 14, height: 1.2, axis: "x", amplitude: 14, periodMs: 4700, phaseMs: 1500, material: "wood", jumpable: true },
  { id: "coaster-service-lift", kind: "elevator", x: -144, z: 145, y: 63, width: 18, depth: 15, height: 1.2, axis: "y", amplitude: 7, periodMs: 5800, phaseMs: 200, material: "metal", jumpable: true },
  { id: "sky-park-crossing", kind: "platform", x: 38, z: -164, y: 93, width: 20, depth: 13, height: 1.2, axis: "z", amplitude: 14, periodMs: 5100, phaseMs: 700, material: "accent", jumpable: true }
];

export const ATHLETICS_STADIUM_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop",
  title: "Skyline Adventure Park",
  subtitle: "Answer for energy. Jump the attractions. Reach the summit.",
  route: ATHLETICS_ROUTE,
  sections: ATHLETICS_SECTIONS,
  checkpoints: Array.from({ length: ATHLETICS_CHECKPOINT_COUNT }, (_, index) => (index + 1) / (ATHLETICS_CHECKPOINT_COUNT + 1)),
  surfaces: ATHLETICS_SURFACES,
  movingObstacles: ATHLETICS_MOVING_OBSTACLES,
  routeWidth: 25,
  finishThreshold: 0.982,
  bounds: ATHLETICS_COURSE_BOUNDS
};

export const ATHLETICS_START_COUNTDOWN_MS = 4_000;
export const ATHLETICS_WRONG_ANSWER_PENALTY_MS = 900;
export const ATHLETICS_RESPAWN_PENALTY_MS = 1_200;
export const ATHLETICS_LAP_TRANSITION_MS = 1_500;
export const ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS = 480;
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

const surfaceToObstacle = (surface: AthleticsCourseSurface): AthleticsObstacle => ({
  id: surface.id,
  kind: "rect",
  x: surface.x,
  z: surface.z,
  width: surface.width,
  depth: surface.depth,
  jumpable: true,
  minY: 0,
  maxY: Math.max(0, surface.y),
  stair: surface.kind === "stair"
});

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
  { id: "park-west-boundary", kind: "rect", x: -226, z: 0, width: 4, depth: 438, minY: 0, maxY: 18 },
  { id: "park-east-boundary", kind: "rect", x: 226, z: 0, width: 4, depth: 438, minY: 0, maxY: 18 },
  { id: "park-north-boundary", kind: "rect", x: 0, z: 224, width: 448, depth: 4, minY: 0, maxY: 18 },
  { id: "park-south-boundary", kind: "rect", x: 0, z: -224, width: 448, depth: 4, minY: 0, maxY: 18 }
];

/** Static collision proxies shared by server movement and the client scene. */
export const ATHLETICS_COLLISION_PROXIES: readonly AthleticsObstacle[] = [
  ...parkBoundaryObstacles,
  ...ATHLETICS_SURFACES.map(surfaceToObstacle)
];

/** Collision includes the same deterministic moving transforms used by the renderer. */
export const getAthleticsObstacles = (nowMs = Date.now()): AthleticsObstacle[] => [
  ...ATHLETICS_COLLISION_PROXIES.map((obstacle) => ({ ...obstacle })),
  ...ATHLETICS_MOVING_OBSTACLES.map((obstacle) => movingObstacleToObstacle(obstacle, nowMs))
];

export const getAthleticsCheckpointProgress = (checkpointIndex: number, checkpointCount: number) =>
  checkpointCount <= 0 ? 1 : clamp01(checkpointIndex / checkpointCount);

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

export const getAthleticsRouteTangent = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const point = getAthleticsPointAtProgress(progress, course);
  const ahead = getAthleticsPointAtProgress(Math.min(1, progress + 0.002), course);
  const length = Math.hypot(ahead.x - point.x, ahead.z - point.z) || 1;
  return { x: (ahead.x - point.x) / length, z: (ahead.z - point.z) / length };
};

export const getAthleticsRouteProgress = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const { lengths, total } = routeLengths(course);
  let distanceBefore = 0;
  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const useVerticalProjection = Number.isFinite(position.y);
  for (let index = 0; index < lengths.length; index += 1) {
    const start = course.route[index]!;
    const end = course.route[index + 1]!;
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
      bestProgress = (distanceBefore + lengths[index]! * part) / total;
    }
    distanceBefore += lengths[index]!;
  }
  return clamp01(bestProgress);
};

export const getAthleticsRouteDistance = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const progress = getAthleticsRouteProgress(position, course);
  const point = getAthleticsPointAtProgress(progress, course);
  return Number.isFinite(position.y)
    ? Math.hypot(position.x - point.x, Number(position.y) - point.y, position.z - point.z)
    : Math.hypot(position.x - point.x, position.z - point.z);
};

export const isAthleticsOnRoute = (
  position: Pick<ArenaPosition, "x" | "z"> & { y?: number },
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => getAthleticsRouteDistance(position, course) <= course.routeWidth;

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
  const progress = getAthleticsCheckpointProgress(checkpointIndex, checkpointCount);
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
  const progress = Math.max(0, getAthleticsCheckpointProgress(checkpointIndex, checkpointCount) - 0.014);
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
