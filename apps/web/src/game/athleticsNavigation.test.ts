import test from "node:test";
import assert from "node:assert/strict";
import { ATHLETICS_PLAYER_EYE_HEIGHT, ATHLETICS_STADIUM_COURSE, getAthleticsMovingObstaclePosition } from "@quizstrike/shared";
import { getAthleticsLandingGuide } from "./athleticsNavigation";

const course = ATHLETICS_STADIUM_COURSE;
const standing = (point: { x: number; y: number; z: number }) => ({ ...point, y: point.y + ATHLETICS_PLAYER_EYE_HEIGHT });

test("every stable main landing guides the adjacent pad or its required lift", () => {
  course.surfaces.slice(0, -1).forEach((surface, index) => {
    const guide = getAthleticsLandingGuide(standing(surface), 0);
    assert.ok(guide, surface.id);
    if (index === 49 || index === 63) assert.equal(guide.kind, "lift", surface.id);
    else if (index === 34 || index === 38) assert.equal(guide.kind, "shuttle", surface.id);
    else assert.equal(guide.id, course.surfaces[index + 1]!.id, surface.id);
  });
  assert.equal(getAthleticsLandingGuide(standing(course.surfaces.at(-1)!), 0)?.id, course.surfaces[0]!.id);
  assert.equal(getAthleticsLandingGuide(standing(course.surfaces[64]!), 0)?.id, course.surfaces[65]!.id);
});

test("shortcut guidance follows the selected branch and rejoins the main route", () => {
  course.shortcuts.forEach((shortcut) => shortcut.surfaces.forEach((surface) => {
    const transition = shortcut.transitions.find((entry) => entry.fromSurfaceId === surface.id)!;
    assert.equal(getAthleticsLandingGuide(standing(surface), 0)?.id, transition.toSurfaceId);
  }));
});

test("lift riders see their exit and airborne players retain the prior target", () => {
  for (const id of course.movingObstacles.filter((entry) => entry.kind !== "barrier").map((entry) => entry.id)) {
    const lift = course.movingObstacles.find((entry) => entry.id === id)!;
    const nowMs = 1000;
    const point = getAthleticsMovingObstaclePosition(lift, nowMs);
    const guide = getAthleticsLandingGuide(standing({ ...point, y: point.y + lift.height }), nowMs);
    assert.equal(guide?.id, course.transitions.find((entry) => entry.movingObstacleId === id)!.toSurfaceId);
  }
  assert.equal(getAthleticsLandingGuide({ x: 0, y: 150, z: 0 }, 0), undefined);
});
