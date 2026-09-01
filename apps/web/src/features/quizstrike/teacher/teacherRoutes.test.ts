import assert from "node:assert/strict";
import test from "node:test";
import { teacherRouteState, teacherTabPath } from "./teacherRoutes.js";

test("teacher routes keep QuizStrike sections stable", () => {
  assert.deepEqual(teacherRouteState("/quiz-strike/teacher"), { tab: "home" });
  assert.deepEqual(teacherRouteState("/quiz-strike/teacher/home"), {
    tab: "home",
  });
  assert.deepEqual(teacherRouteState("/quiz-strike/teacher/sets/set-1"), {
    tab: "detail",
    studySetId: "set-1",
  });
  assert.deepEqual(teacherRouteState("/quiz-strike/teacher/host/set-2"), {
    tab: "sessions",
    studySetId: "set-2",
  });
  assert.equal(
    teacherTabPath("tournaments"),
    "/quiz-strike/teacher/competitions",
  );
});

test("legacy Speaking teacher routes resolve to the unified dashboard", () => {
  assert.deepEqual(teacherRouteState("/speak/teacher"), { tab: "speaking" });
  assert.deepEqual(teacherRouteState("/speak/teacher/create"), {
    tab: "speaking",
  });
  assert.deepEqual(
    teacherRouteState(
      "/quiz-strike/teacher/speaking/activity/activity-1/results",
    ),
    { tab: "speaking" },
  );
  assert.equal(teacherTabPath("speaking"), "/quiz-strike/teacher/speaking");
});

test("teacher routes fail safely for malformed bookmark segments", () => {
  assert.deepEqual(teacherRouteState("/quiz-strike/teacher/sets/%E0%A4%A"), {
    tab: "detail",
    studySetId: "%E0%A4%A",
  });
});
