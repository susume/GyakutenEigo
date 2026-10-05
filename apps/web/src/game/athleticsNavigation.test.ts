import test from "node:test";
import assert from "node:assert/strict";
import { ATHLETICS_PLAYER_EYE_HEIGHT, ATHLETICS_STADIUM_COURSE, getAthleticsMovingObstaclePosition } from "@quizstrike/shared";
import { getAthleticsLandingGuide } from "./athleticsNavigation";

const course = ATHLETICS_STADIUM_COURSE;
const standing = (point: { x: number; y: number; z: number }) => ({ ...point, y: point.y + ATHLETICS_PLAYER_EYE_HEIGHT });

test("every stable main landing guides the adjacent pad or its required lift", () => {
  course.surfaces.slice(0, -1).forEach((surface, index) => {
    if (surface.movingObstacleId) return;
    const guide = getAthleticsLandingGuide(standing(surface), 0);
    assert.ok(guide, surface.id);
    if (index === 49 || index === 63) assert.equal(guide.kind, "lift", surface.id);
    else if ([33, 34, 36, 38, 40, 41].includes(index)) assert.equal(guide.kind, "shuttle", surface.id);
    else if (index === 43) assert.equal(guide.id, course.surfaces[44]!.movingObstacleId, surface.id);
    else assert.equal(guide.id, course.surfaces[index + 1]!.id, surface.id);
  });
  assert.equal(getAthleticsLandingGuide(standing(course.surfaces.at(-1)!), 0)?.id, course.surfaces[0]!.id);
  assert.equal(getAthleticsLandingGuide(standing(course.surfaces[64]!), 0)?.id, course.surfaces[65]!.id);
});

test("rising pink platform guidance follows its moving destination or the blue connecting lift", () => {
  const floats = course.surfaces.slice(44, 54);
  for (const surface of floats) {
    const mover = course.movingObstacles.find((obstacle) => obstacle.id === surface.movingObstacleId)!;
    for (const nowMs of [0, 1200, 2700, 4100]) {
      const point = getAthleticsMovingObstaclePosition(mover, nowMs);
      const guide = getAthleticsLandingGuide(standing({ ...point, y: point.y + mover.height }), nowMs)!;
      assert.ok(guide, mover.id);
      const next = course.surfaces[course.surfaces.indexOf(surface) + 1]!;
      if (guide.id === "power-stairs-lift") continue;
      assert.equal(guide.id, next.movingObstacleId ?? next.id);
      const nextMover = course.movingObstacles.find((obstacle) => obstacle.id === next.movingObstacleId);
      assert.equal(guide.y, nextMover ? getAthleticsMovingObstaclePosition(nextMover, nowMs).y + nextMover.height : next.y);
    }
  }
});

test("shortcut guidance follows the selected branch and rejoins the main route", () => {
  course.shortcuts.forEach((shortcut) => shortcut.surfaces.forEach((surface) => {
    const transition = shortcut.transitions.find((entry) => entry.fromSurfaceId === surface.id)!;
    assert.equal(getAthleticsLandingGuide(standing(surface), 0)?.id, transition.toSurfaceId);
  }));
});

test("lift riders see their exit and airborne players retain the prior target", () => {
  for (const id of course.movingObstacles.filter((entry) => entry.kind !== "barrier" && !course.surfaces.some((surface) => surface.movingObstacleId === entry.id)).map((entry) => entry.id)) {
    const lift = course.movingObstacles.find((entry) => entry.id === id)!;
    const nowMs = 1000;
    const point = getAthleticsMovingObstaclePosition(lift, nowMs);
    const guide = getAthleticsLandingGuide(standing({ ...point, y: point.y + lift.height }), nowMs);
    const exitId = course.transitions.find((entry) => entry.movingObstacleId === id)!.toSurfaceId;
    const exit = course.surfaces.find((surface) => surface.id === exitId)!;
    assert.equal(guide?.id, exit.movingObstacleId ?? exit.id);
  }
  assert.equal(getAthleticsLandingGuide({ x: 0, y: 150, z: 0 }, 0), undefined);
});
