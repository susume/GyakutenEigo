import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SESSION_SETTINGS, type TeacherUser } from "@quizstrike/shared";
import {
  advanceMatchWinner,
  canManageTournament,
  generateSingleEliminationBracket,
  nextBracketSize,
  publicStudyPack,
  sanitizeSponsorUrl,
  sanitizeStudyItems,
  validStatusTransition,
  verifySessionResult,
  type OfficialMatchSettings,
  type Tournament,
  type TournamentTeam
} from "./tournamentDomain.js";

const now = new Date("2026-08-04T00:00:00.000Z");
const organizer: TeacherUser = { id: "teacher-1", name: "Ms. Tournament", email: "tournament@example.test", role: "teacher" };
const settings: OfficialMatchSettings = {
  ...DEFAULT_SESSION_SETTINGS,
  teamSize: 4,
  preparationDurationSeconds: 30,
  botPolicy: "none",
  rewardsEnabled: true
};
const team = (id: string, createdAt = now.toISOString()): TournamentTeam => ({
  id,
  tournamentId: "tournament-1",
  teamName: id,
  schoolName: "School",
  managerUserId: organizer.id,
  managerName: organizer.name,
  roster: [{ id: `${id}-player`, displayName: `${id} Player` }],
  substitutes: [],
  color: "blue",
  registrationStatus: "APPROVED",
  checkedIn: false,
  createdAt,
  updatedAt: createdAt
});
const tournament = (teams: TournamentTeam[]): Tournament => ({
  id: "tournament-1",
  slug: "test-tournament",
  ownerId: organizer.id,
  ownerName: organizer.name,
  title: "Test Tournament",
  description: "A test",
  level: "SCHOOL_VS_SCHOOL",
  status: "REGISTRATION_OPEN",
  tournamentAt: new Date(now.getTime() + 86_400_000).toISOString(),
  registrationDeadline: new Date(now.getTime() + 43_200_000).toISOString(),
  timeZone: "Asia/Tokyo",
  maximumTeams: 16,
  quizSetId: "quiz-1",
  quizSetName: "Quiz",
  rules: settings,
  teams,
  matches: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
});

test("bracket sizing accepts supported team counts and rejects overflow", () => {
  assert.equal(nextBracketSize(2), 2);
  assert.equal(nextBracketSize(3), 4);
  assert.equal(nextBracketSize(8), 8);
  assert.equal(nextBracketSize(12), 16);
  assert.throws(() => nextBracketSize(17));
});

test("single elimination bracket creates deterministic matches and automatic byes", () => {
  const item = tournament([team("A"), team("B"), team("C")]);
  const matches = generateSingleEliminationBracket(item, now);
  assert.equal(matches.length, 3);
  assert.equal(matches.filter((match) => match.roundNumber === 1).length, 2);
  assert.equal(matches.filter((match) => match.status === "BYE").length, 1);
  const final = matches.find((match) => match.roundLabel === "Final");
  assert.equal(final?.teamBId, "C");
  assert.equal(matches[0]?.id, "tournament-1-match-1");
});

test("winner advancement is server-side and completes a final", () => {
  const item = tournament([team("A"), team("B")]);
  const [match] = generateSingleEliminationBracket(item, now);
  assert.ok(match);
  assert.equal(advanceMatchWinner(item, match, "A", now).ok, true);
  assert.equal(item.championTeamId, "A");
  assert.equal(item.status, "COMPLETED");
  assert.equal(advanceMatchWinner(item, match, "B", now).ok, false);
});

test("study pack and sponsor URL are sanitized for public use", () => {
  let id = 0;
  const items = sanitizeStudyItems([{ term: "adapt", meaning: "change", correctChoice: "A" }, { term: "" }], () => `item-${++id}`);
  assert.deepEqual(items.map((item) => item.term), ["adapt"]);
  const pack = publicStudyPack({ id: "pack", releaseAt: now.toISOString(), items, updatedAt: now.toISOString() }, now);
  assert.equal(pack?.items[0]?.term, "adapt");
  assert.equal("correctChoice" in (pack?.items[0] ?? {}), false);
  assert.equal(sanitizeSponsorUrl("javascript:alert(1)"), undefined);
  assert.equal(sanitizeSponsorUrl("https://school.example/sponsor"), "https://school.example/sponsor");
});

test("status transitions and tournament ownership are explicit", () => {
  const item = tournament([]);
  assert.equal(validStatusTransition("DRAFT", "REGISTRATION_OPEN"), true);
  assert.equal(validStatusTransition("COMPLETED", "LIVE"), false);
  assert.equal(canManageTournament(organizer, item), true);
  assert.equal(canManageTournament({ ...organizer, id: "other" }, item), false);
});

test("verified result reads scores from the completed QuizStrike session", () => {
  const item = tournament([team("A"), team("B")]);
  const [match] = generateSingleEliminationBracket(item, now);
  assert.ok(match);
  const verified = verifySessionResult({ tournament: item, match, session: { id: "session-1", status: "ended", roundWins: { blue: 3, red: 1 }, players: [] }, at: now });
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.result.winnerTeamId, "A");
    assert.equal(verified.result.sourceSessionId, "session-1");
  }
});
