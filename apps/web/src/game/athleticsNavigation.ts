import {
  ATHLETICS_JUMP_APEX_HEIGHT,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_STADIUM_COURSE,
  getAthleticsPhysicalSupport,
  getAthleticsMovingObstaclePosition,
  getAthleticsTransitionJumpEnvelope,
  type AthleticsCourseDefinition
} from "@quizstrike/shared";

export interface AthleticsLandingGuide {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: "landing" | "lift" | "shuttle";
}

/** Follow authored adjacency, never a distance threshold that skips pads.
 * In flight the caller retains the last guide until a new landing is made. */
export const getAthleticsLandingGuide = (
  position: { x: number; y: number; z: number },
  nowMs: number,
  course: AthleticsCourseDefinition = ATHLETICS_STADIUM_COURSE
): AthleticsLandingGuide | null | undefined => {
  const support = getAthleticsPhysicalSupport(position, course, ATHLETICS_PLAYER_EYE_HEIGHT, nowMs);
  const allSurfaces = [...course.surfaces, ...course.shortcuts.flatMap((shortcut) => shortcut.surfaces)];
  const transitions = [...course.transitions, ...course.shortcuts.flatMap((shortcut) => shortcut.transitions)];
  const transition = support.kind === "moving_platform"
    ? course.transitions.find((entry) => entry.movingObstacleId === support.obstacleId)
    : transitions.find((entry) => entry.fromSurfaceId === support.surfaceId);
  if (!transition) {
    return support.surfaceId === course.surfaces.at(-1)?.id ? null : undefined;
  }
  const destination = allSurfaces.find((surface) => surface.id === transition.toSurfaceId);
  if (!destination) return undefined;
  const lift = course.movingObstacles.find((obstacle) => obstacle.id === transition.movingObstacleId && obstacle.kind === "elevator");
  if (lift && support.kind !== "moving_platform" && destination.y - support.supportY > ATHLETICS_JUMP_APEX_HEIGHT) {
    const point = getAthleticsMovingObstaclePosition(lift, nowMs);
    return { id: lift.id, ...point, y: point.y + lift.height, kind: "lift" };
  }
  const shuttle = course.movingObstacles.find((obstacle) => obstacle.id === transition.movingObstacleId && obstacle.kind === "platform");
  const envelope = getAthleticsTransitionJumpEnvelope(transition, course);
  if (shuttle && support.kind !== "moving_platform" && envelope.airGap > envelope.horizontalReach) {
    const point = getAthleticsMovingObstaclePosition(shuttle, nowMs);
    return { id: shuttle.id, ...point, y: point.y + shuttle.height, kind: "shuttle" };
  }
  return { id: destination.id, x: destination.x, y: destination.y, z: destination.z, kind: "landing" };
};
