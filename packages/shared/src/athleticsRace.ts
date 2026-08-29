import type { ArenaPosition, PlayerSession } from "./index.js";

export type AthleticsCourseId = "stadium_loop";

export type AthleticsRaceStatus = "countdown" | "running" | "finished" | "expired";
export type AthleticsPlayerStatus = "racing" | "finished" | "dnf";

export interface AthleticsRaceState {
  courseId: AthleticsCourseId;
  /** Number of checkpoint questions assigned on every lap. */
  questionsPerLap: number;
  /** Total checkpoint questions required to finish the whole race. */
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
  /** Number of safe checkpoint zones reached after opening their gate. */
  checkpointIndex: number;
  routeProgress: number;
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

export interface AthleticsCourseSection {
  id: string;
  label: string;
  description: string;
  startProgress: number;
  endProgress: number;
  accent: "cyan" | "orange" | "lime" | "violet" | "pink" | "gold";
}

export interface AthleticsCourseDefinition {
  id: AthleticsCourseId;
  title: string;
  subtitle: string;
  route: readonly Readonly<Pick<ArenaPosition, "x" | "z">>[];
  sections: readonly AthleticsCourseSection[];
  routeWidth: number;
  finishThreshold: number;
}

/**
 * A compact, authored first-person route that fits inside the existing arena
 * camera and networking limits. The path bends often enough to keep the
 * stadium readable from the ground while every section has a distinct visual
 * silhouette for orientation.
 */
export const ATHLETICS_STADIUM_COURSE: AthleticsCourseDefinition = {
  id: "stadium_loop",
  title: "Stadium Loop",
  subtitle: "Sprint the lanes. Clear the gates. Earn every next step.",
  route: [
    { x: 0, z: 84 },
    { x: 0, z: 58 },
    { x: 15, z: 28 },
    { x: -15, z: 0 },
    { x: 0, z: -30 },
    { x: 22, z: -58 },
    { x: -20, z: -82 },
    { x: 0, z: -94 }
  ],
  sections: [
    {
      id: "opening-sprint",
      label: "Opening Sprint",
      description: "Leave the blocks and build speed.",
      startProgress: 0,
      endProgress: 0.14,
      accent: "cyan"
    },
    {
      id: "hurdle-straight",
      label: "Hurdle Straight",
      description: "Jump the low bars without losing your line.",
      startProgress: 0.14,
      endProgress: 0.28,
      accent: "orange"
    },
    {
      id: "slalom-alley",
      label: "Slalom Alley",
      description: "Thread the cones and take the inside turn.",
      startProgress: 0.28,
      endProgress: 0.43,
      accent: "lime"
    },
    {
      id: "balance-bend",
      label: "Balance Bend",
      description: "Cross the raised beam and drop into the bend.",
      startProgress: 0.43,
      endProgress: 0.58,
      accent: "violet"
    },
    {
      id: "timing-gate",
      label: "Timing Gate",
      description: "Jump the bright bar and stay centered.",
      startProgress: 0.58,
      endProgress: 0.72,
      accent: "pink"
    },
    {
      id: "platform-rise",
      label: "Platform Rise",
      description: "Use the stepped pads to keep your momentum.",
      startProgress: 0.72,
      endProgress: 0.84,
      accent: "gold"
    },
    {
      id: "finish-chicane",
      label: "Finish Chicane",
      description: "Clear the final bar and launch for the tape.",
      startProgress: 0.84,
      endProgress: 1,
      accent: "cyan"
    }
  ],
  routeWidth: 9.5,
  finishThreshold: 0.985
};

export const ATHLETICS_START_COUNTDOWN_MS = 4_000;
export const ATHLETICS_WRONG_ANSWER_PENALTY_MS = 900;
export const ATHLETICS_RESPAWN_PENALTY_MS = 1_200;
export const ATHLETICS_LAP_TRANSITION_MS = 1_500;
export const ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS = 300;
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
  | { id: string; kind: "rect"; x: number; z: number; width: number; depth: number; jumpable?: boolean; minY?: number; maxY?: number }
  | { id: string; kind: "circle"; x: number; z: number; radius: number; jumpable?: boolean; minY?: number; maxY?: number };

const rect = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  options: Pick<Extract<AthleticsObstacle, { kind: "rect" }>, "jumpable" | "minY" | "maxY"> = {}
): AthleticsObstacle => ({ id, kind: "rect", x, z, width, depth, ...options });

const circle = (
  id: string,
  x: number,
  z: number,
  radius: number,
  options: Pick<Extract<AthleticsObstacle, { kind: "circle" }>, "jumpable" | "minY" | "maxY"> = {}
): AthleticsObstacle => ({ id, kind: "circle", x, z, radius, ...options });

/** Static collision proxies shared by server movement and the client scene. */
export const ATHLETICS_COLLISION_PROXIES: readonly AthleticsObstacle[] = [
  rect("stadium-west-wall", -58, -4, 4, 190, { minY: 0, maxY: 18 }),
  rect("stadium-east-wall", 58, -4, 4, 190, { minY: 0, maxY: 18 }),
  rect("stadium-north-wall", 0, 101, 112, 4, { minY: 0, maxY: 18 }),
  rect("stadium-finish-wall", 0, -101, 112, 4, { minY: 0, maxY: 18 }),
  rect("hurdle-one", 0, 51, 10, 1.2, { jumpable: true, minY: 0, maxY: 1.6 }),
  rect("hurdle-two", 0, 43, 10, 1.2, { jumpable: true, minY: 0, maxY: 1.6 }),
  rect("hurdle-three", 0, 35, 10, 1.2, { jumpable: true, minY: 0, maxY: 1.6 }),
  circle("slalom-cone-one", 9, 25, 1.1, { jumpable: true, maxY: 1.4 }),
  circle("slalom-cone-two", 20, 14, 1.1, { jumpable: true, maxY: 1.4 }),
  circle("slalom-cone-three", 8, 4, 1.1, { jumpable: true, maxY: 1.4 }),
  circle("slalom-cone-four", -11, -7, 1.1, { jumpable: true, maxY: 1.4 }),
  rect("balance-beam", -15, -15, 4.4, 18, { jumpable: true, minY: 0, maxY: 1.2 }),
  rect("moving-gate-left-post", -8, -39, 1.2, 3, { minY: 0, maxY: 7 }),
  rect("moving-gate-right-post", 8, -39, 1.2, 3, { minY: 0, maxY: 7 }),
  rect("moving-gate-bar", 0, -39, 15, 1.2, { jumpable: true, minY: 3.1, maxY: 4.2 }),
  rect("platform-rise-one", 13, -56, 6, 5, { jumpable: true, minY: 0, maxY: 1.4 }),
  rect("platform-rise-two", 22, -65, 6, 5, { jumpable: true, minY: 0, maxY: 2.6 }),
  rect("platform-rise-three", 7, -74, 6, 5, { jumpable: true, minY: 0, maxY: 3.8 }),
  rect("finish-chicane-base", -20, -83, 2.5, 2.5, { minY: 0, maxY: 2.4 }),
  rect("finish-chicane-bar", -20, -83, 26, 0.7, { jumpable: true, minY: 1.9, maxY: 2.4 })
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const segmentLength = (start: Pick<ArenaPosition, "x" | "z">, end: Pick<ArenaPosition, "x" | "z">) =>
  Math.hypot(end.x - start.x, end.z - start.z);

const routeLengths = (course: AthleticsCourseDefinition) => {
  const lengths = course.route.slice(1).map((point, index) => segmentLength(course.route[index]!, point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { lengths, total: total || 1 };
};

export const getAthleticsCheckpointProgress = (checkpointIndex: number, questionCount: number) =>
  questionCount <= 0 ? 1 : clamp01(checkpointIndex / questionCount);

export const getAthleticsNextGateProgress = (player: Pick<AthleticsPlayerState, "checkpointIndex" | "questionIndex">, questionCount: number) =>
  player.questionIndex >= questionCount
    ? 1
    : getAthleticsCheckpointProgress(Math.max(1, player.checkpointIndex + 1), questionCount);

export const getAthleticsPointAtProgress = (
  progress: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
): Readonly<Pick<ArenaPosition, "x" | "z">> => {
  const target = clamp01(progress);
  const { lengths, total } = routeLengths(course);
  let distance = target * total;
  for (let index = 0; index < lengths.length; index += 1) {
    const start = course.route[index]!;
    const end = course.route[index + 1]!;
    const length = lengths[index]!;
    if (distance <= length || index === lengths.length - 1) {
      const part = length <= 0 ? 0 : Math.min(1, Math.max(0, distance / length));
      return { x: start.x + (end.x - start.x) * part, z: start.z + (end.z - start.z) * part };
    }
    distance -= length;
  }
  return course.route[course.route.length - 1]!;
};

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
  position: Pick<ArenaPosition, "x" | "z">,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const { lengths, total } = routeLengths(course);
  let distanceBefore = 0;
  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lengths.length; index += 1) {
    const start = course.route[index]!;
    const end = course.route[index + 1]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz || 1;
    const part = Math.min(1, Math.max(0, ((position.x - start.x) * dx + (position.z - start.z) * dz) / lengthSquared));
    const nearestX = start.x + dx * part;
    const nearestZ = start.z + dz * part;
    const distance = Math.hypot(position.x - nearestX, position.z - nearestZ);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = (distanceBefore + lengths[index]! * part) / total;
    }
    distanceBefore += lengths[index]!;
  }
  return clamp01(bestProgress);
};

export const getAthleticsRouteDistance = (
  position: Pick<ArenaPosition, "x" | "z">,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const progress = getAthleticsRouteProgress(position, course);
  const point = getAthleticsPointAtProgress(progress, course);
  return Math.hypot(position.x - point.x, position.z - point.z);
};

export const isAthleticsOnRoute = (
  position: Pick<ArenaPosition, "x" | "z">,
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
    y: 4.21,
    z: start.z + normal.z * centeredLane * 1.8 - tangent.z * laneRow * 1.6,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

export const getAthleticsCheckpointPosition = (
  checkpointIndex: number,
  questionCount: number,
  laneOffset = 0,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const progress = getAthleticsCheckpointProgress(checkpointIndex, questionCount);
  const point = getAthleticsPointAtProgress(progress, course);
  const tangent = getAthleticsRouteTangent(progress, course);
  const normal = { x: -tangent.z, z: tangent.x };
  return {
    x: point.x + normal.x * laneOffset,
    y: 4.21,
    z: point.z + normal.z * laneOffset,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

export const getAthleticsRespawnPosition = (
  checkpointIndex: number,
  questionCount: number,
  laneIndex = 0,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => {
  const progress = Math.max(0, getAthleticsCheckpointProgress(checkpointIndex, questionCount) - 0.018);
  const point = getAthleticsPointAtProgress(progress, course);
  const tangent = getAthleticsRouteTangent(progress, course);
  const normal = { x: -tangent.z, z: tangent.x };
  const laneOffset = (laneIndex % 5 - 2) * 1.3;
  return {
    x: point.x + normal.x * laneOffset,
    y: 4.21,
    z: point.z + normal.z * laneOffset,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
};

export const isAthleticsFinish = (
  position: Pick<ArenaPosition, "x" | "z">,
  questionIndex: number,
  questionCount: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
) => questionCount > 0 && questionIndex >= questionCount
  && getAthleticsRouteProgress(position, course) >= course.finishThreshold
  && getAthleticsRouteDistance(position, course) <= course.routeWidth + 3;

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
