import assert from "node:assert/strict";
import test from "node:test";
import type { TeacherUser } from "@quizstrike/shared";
import {
  buildEliminationBracket,
  canAccessMatchRoom,
  canManageCompetition,
  canViewStudyPack,
  confirmMatchResult,
  effectiveCompetitionStatus,
  scheduleCompetitionNotifications,
  seedCompetitions,
  studyPackReleased,
  validateTeamRegistration,
  type CompetitionState
} from "./competitionDomain.js";

const organizer: TeacherUser = { id: "teacher-1", name: "Ms. Arena", email: "arena@example.com", role: "teacher" };
const date = new Date("2026-08-02T00:00:00.000Z");
const competition = () => seedCompetitions(organizer, date, (() => {
  let count = 0;
  return () => `id-${++count}`;
})())[0];

test("competition visibility respects invitation and lifecycle status", () => {
  const item = competition();
  assert.equal(effectiveCompetitionStatus(item, new Date("2026-07-31T00:00:00.000Z")), "ANNOUNCED");
  assert.equal(effectiveCompetitionStatus(item, new Date("2026-08-05T00:00:00.000Z")), "REGISTRATION_OPEN");
  item.visibility = "INVITATION_ONLY";
  assert.equal(canViewStudyPack(item, undefined, new Date("2026-08-10T00:00:00.000Z")), false);
});

test("pre-release study pack is denied and release is server-authoritative", () => {
  const item = competition();
  assert.equal(studyPackReleased(item, new Date("2026-08-04T23:59:59.000Z")), false);
  assert.equal(canViewStudyPack(item, undefined, new Date("2026-08-04T23:59:59.000Z")), false);
  assert.equal(studyPackReleased(item, new Date("2026-08-05T00:00:00.000Z")), true);
  assert.equal(canViewStudyPack(item, undefined, new Date("2026-08-05T00:00:00.000Z")), true);
});

test("roster limits and duplicate player prevention are enforced", () => {
  const item = competition();
  const first = validateTeamRegistration({
    competition: item,
    teamName: "North Stars",
    affiliation: "North School",
    activePlayers: [
      { id: "p1", displayName: "Mika", playerKey: "student-1" },
      { id: "p2", displayName: "Ren", playerKey: "student-2" }
    ],
    substitutePlayers: [],
    at: date
  });
  assert.equal(first.ok, true);
  item.teams.push({
    id: "team-1",
    competitionId: item.id,
    teamName: "North Stars",
    affiliation: "North School",
    captainUserId: organizer.id,
    captainName: organizer.name,
    activePlayers: [{ id: "p1", displayName: "Mika", playerKey: "student-1" }],
    substitutePlayers: [],
    registrationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    checkInStatus: "NOT_OPEN",
    division: item.division,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString()
  });
  const duplicate = validateTeamRegistration({
    competition: item,
    teamName: "South Stars",
    affiliation: "South School",
    activePlayers: [{ id: "p3", displayName: "Mika", playerKey: "student-1" }],
    substitutePlayers: [],
    at: date
  });
  assert.equal(duplicate.ok, false);
});

test("organizer permissions, bracket progression, and result confirmation are server-side", () => {
  const item = competition();
  assert.equal(canManageCompetition(organizer, item), true);
  const other: TeacherUser = { ...organizer, id: "teacher-2" };
  assert.equal(canManageCompetition(other, item), false);
  item.teams = [1, 2].map((number) => ({
    id: `team-${number}`,
    competitionId: item.id,
    teamName: `Team ${number}`,
    affiliation: "School",
    captainUserId: `captain-${number}`,
    captainName: `Captain ${number}`,
    activePlayers: [],
    substitutePlayers: [],
    registrationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    checkInStatus: "NOT_OPEN",
    seed: number,
    division: item.division,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString()
  }));
  const matches = buildEliminationBracket(item, date);
  assert.equal(matches.length, 1);
  assert.equal(confirmMatchResult({ competition: item, matchId: matches[0].id, result: { homeScore: 4, awayScore: 2, winnerTeamId: "team-1" }, confirmedByName: organizer.name, at: date }).ok, true);
  assert.equal(item.matches[0].status, "CONFIRMED");
});

test("official match room only admits authorized roster staff or player tokens", () => {
  const item = competition();
  item.teams[0] = {
    id: "team-1",
    competitionId: item.id,
    teamName: "North Stars",
    affiliation: "North School",
    captainUserId: "captain-1",
    captainName: "Captain",
    coachUserId: "coach-1",
    coachName: "Coach",
    activePlayers: [],
    substitutePlayers: [],
    registrationStatus: "APPROVED",
    eligibilityStatus: "ELIGIBLE",
    checkInStatus: "CHECKED_IN",
    division: item.division,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString()
  };
  const match = { id: "match", competitionId: item.id, roundLabel: "Final", bracketPosition: 1, homeTeamId: "team-1", scheduledAt: date.toISOString(), checkInOpensAt: date.toISOString(), map: "Desert Citadel", gameMode: "Flag", status: "LIVE" as const, sessionCode: "ROOM1" };
  assert.equal(canAccessMatchRoom({ competition: item, match, userId: "coach-1" }), true);
  assert.equal(canAccessMatchRoom({ competition: item, match, userId: "stranger" }), false);
  assert.equal(canAccessMatchRoom({ competition: item, match, isPlayerTokenAuthorized: true, playerDisplayName: "Captain" }), false);
  item.teams[0].activePlayers = [{ id: "p1", displayName: "Captain" }];
  assert.equal(canAccessMatchRoom({ competition: item, match, isPlayerTokenAuthorized: true, playerDisplayName: "Captain" }), true);
});

test("notification scheduler is idempotent", () => {
  const item = competition();
  item.studyPackReleaseAt = "2026-08-03T00:00:00.000Z";
  const state: CompetitionState = { competitions: new Map([[item.id, item]]), notifications: new Map(), auditLogs: [], nextId: (() => { let id = 0; return () => `notification-${++id}`; })() };
  scheduleCompetitionNotifications(state, new Date("2026-08-04T00:00:00.000Z"));
  scheduleCompetitionNotifications(state, new Date("2026-08-04T00:00:00.000Z"));
  assert.equal([...state.notifications.values()].filter((notification) => notification.kind === "STUDY_PACK_RELEASED").length, 1);
});
