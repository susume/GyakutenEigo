import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

type Runtime = typeof import("./index.js");
let runtime: Runtime;
let baseUrl = "";
let counter = 0;

const api = async <T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}) => {
  const headers = new Headers();
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await response.text();
  return { response, body: (text ? JSON.parse(text) : {}) as T };
};

test.before(async () => {
  process.env.QUIZSTRIKE_NO_AUTOSTART = "true";
  process.env.JWT_SECRET = "tournament-integration-secret";
  process.env.DATABASE_URL = " ";
  process.env.NODE_ENV = "test";
  runtime = await import("./index.js");
  await new Promise<void>((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const address = runtime.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => runtime.io.close(() => resolve()));
  if (runtime.server.listening) await new Promise<void>((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));
});

test("tournament HTTP workflow protects ownership, publishes study content, and generates a bracket", { timeout: 30_000 }, async () => {
  counter += 1;
  const teacher = await api<{ token: string; user: { id: string } }>("/api/auth/signup", { method: "POST", body: { name: `Tournament Teacher ${counter}`, email: `tournament-${Date.now()}-${counter}@example.test`, password: "classroom-pass" } });
  assert.equal(teacher.response.status, 201);
  const quiz = await api<{ quizSet: { id: string } }>("/api/quiz-sets", { method: "POST", token: teacher.body.token, body: { title: "Tournament Vocabulary" } });
  assert.equal(quiz.response.status, 201);
  const question = await api(`/api/quiz-sets/${quiz.body.quizSet.id}/questions`, { method: "POST", token: teacher.body.token, body: { prompt: "Pick A", choiceA: "A", choiceB: "B", choiceC: "C", choiceD: "D", correctChoice: "A" } });
  assert.equal(question.response.status, 201);
  const invalidSchedule = await api("/api/tournaments", { method: "POST", token: teacher.body.token, body: { title: "Invalid Schedule", level: "SCHOOL_VS_SCHOOL", tournamentAt: "not-a-date", maximumTeams: 2, quizSetId: quiz.body.quizSet.id, studyItems: [{ term: "adapt" }] } });
  assert.equal(invalidSchedule.response.status, 400);
  const tournament = await api<{ tournament: { id: string } }>("/api/tournaments", { method: "POST", token: teacher.body.token, body: {
    title: "Midori Schools Cup",
    description: "A test event",
    level: "SCHOOL_VS_SCHOOL",
    tournamentAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    registrationDeadline: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    studyPackReleaseAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    maximumTeams: 4,
    quizSetId: quiz.body.quizSet.id,
    studyItems: [{ term: "adapt", meaning: "change", example: "Adapt to the map." }]
  } });
  assert.equal(tournament.response.status, 201);
  const id = tournament.body.tournament.id;
  const publicBeforeRelease = await api<{ released: boolean; studyPack: { items: unknown[] } }>(`/api/tournament-study/${id}`);
  assert.equal(publicBeforeRelease.response.status, 200);
  assert.equal(publicBeforeRelease.body.released, false);
  assert.deepEqual(publicBeforeRelease.body.studyPack.items, []);
  const otherTeacher = await api<{ token: string }>("/api/auth/signup", { method: "POST", body: { name: "Another Teacher", email: `other-${Date.now()}-${counter}@example.test`, password: "classroom-pass" } });
  const forbiddenEdit = await api(`/api/tournaments/${id}`, { method: "PATCH", token: otherTeacher.body.token, body: { title: "Hijacked" } });
  assert.equal(forbiddenEdit.response.status, 403);
  const releaseDraft = await api(`/api/tournaments/${id}/study-pack/release`, { method: "POST", token: teacher.body.token });
  assert.equal(releaseDraft.response.status, 409);
  const invalidStudySchedule = await api(`/api/tournaments/${id}/study-pack`, { method: "POST", token: teacher.body.token, body: { releaseAt: new Date(Date.now() + 8 * 86_400_000).toISOString(), items: [{ term: "adapt" }] } });
  assert.equal(invalidStudySchedule.response.status, 400);
  const published = await api(`/api/tournaments/${id}/publish`, { method: "POST", token: teacher.body.token });
  assert.equal(published.response.status, 200);
  const invitation = await api<{ code: string }>(`/api/tournaments/${id}/invitations`, { method: "POST", token: teacher.body.token });
  assert.equal(invitation.response.status, 201);
  const invitationDetails = await api<{ tournament: Record<string, unknown>; teamSize: number }>(`/api/tournament-invitations/${id}?code=${encodeURIComponent(invitation.body.code)}`);
  assert.equal(invitationDetails.response.status, 200);
  assert.equal(invitationDetails.body.teamSize, 4);
  assert.equal("ownerId" in invitationDetails.body.tournament, false);
  const invitedTeam = await api<{ team: { id: string }; tournament: Record<string, unknown> }>(`/api/tournaments/${id}/teams`, { method: "POST", token: otherTeacher.body.token, body: { invitationCode: invitation.body.code, teamName: "North Stars", schoolName: "North Stars School", roster: [{ displayName: "Captain" }] } });
  assert.equal(invitedTeam.response.status, 201);
  assert.equal("ownerId" in invitedTeam.body.tournament, false);
  const publicTeams = (invitedTeam.body.tournament.teams ?? []) as Array<Record<string, unknown>>;
  assert.equal("managerName" in (publicTeams[0] ?? {}), false);
  const reusedInvitation = await api(`/api/tournaments/${id}/teams`, { method: "POST", token: otherTeacher.body.token, body: { invitationCode: invitation.body.code, teamName: "Duplicate", schoolName: "Duplicate School", roster: [{ displayName: "Captain" }] } });
  assert.equal(reusedInvitation.response.status, 403);
  const approved = await api(`/api/tournaments/${id}/teams/${invitedTeam.body.team.id}/approve`, { method: "POST", token: teacher.body.token });
  assert.equal(approved.response.status, 200);
  const ownerTeam = await api<{ team: { id: string } }>(`/api/tournaments/${id}/teams`, { method: "POST", token: teacher.body.token, body: { teamName: "South Stars", schoolName: "South Stars School", roster: [{ displayName: "Captain" }] } });
  assert.equal(ownerTeam.response.status, 201);
  const released = await api(`/api/tournaments/${id}/study-pack/release`, { method: "POST", token: teacher.body.token });
  assert.equal(released.response.status, 200);
  const bracket = await api<{ matches: Array<{ id: string; status: string }> }>(`/api/tournaments/${id}/bracket`, { method: "POST", token: teacher.body.token });
  assert.equal(bracket.response.status, 201);
  assert.equal(bracket.body.matches.length, 1);
  const matchId = bracket.body.matches[0]!.id;
  const invitedCheckIn = await api(`/api/tournaments/${id}/teams/${invitedTeam.body.team.id}/check-in`, { method: "POST", token: otherTeacher.body.token });
  assert.equal(invitedCheckIn.response.status, 200);
  const ownerCheckIn = await api(`/api/tournaments/${id}/teams/${ownerTeam.body.team.id}/check-in`, { method: "POST", token: teacher.body.token });
  assert.equal(ownerCheckIn.response.status, 200);
  const mismatchedRoom = await api<{ session: { sessionCode: string } }>("/api/sessions", { method: "POST", token: teacher.body.token, body: { quizSetId: quiz.body.quizSet.id, settings: { mapId: "iron_junction" } } });
  assert.equal(mismatchedRoom.response.status, 201);
  const mismatchLaunch = await api(`/api/tournaments/${id}/matches/${matchId}/launch`, { method: "POST", token: teacher.body.token, body: { sessionCode: mismatchedRoom.body.session.sessionCode } });
  assert.equal(mismatchLaunch.response.status, 409);
  const officialRoom = await api<{ session: { sessionCode: string } }>("/api/sessions", { method: "POST", token: teacher.body.token, body: { quizSetId: quiz.body.quizSet.id } });
  assert.equal(officialRoom.response.status, 201);
  const launched = await api<{ match: { settingsLockedAt?: string; status: string }; session: { status: string } }>(`/api/tournaments/${id}/matches/${matchId}/launch`, { method: "POST", token: teacher.body.token, body: { sessionCode: officialRoom.body.session.sessionCode } });
  assert.equal(launched.response.status, 200);
  assert.equal(launched.body.match.status, "CHECK_IN");
  assert.ok(launched.body.match.settingsLockedAt);
  const relaunch = await api(`/api/tournaments/${id}/matches/${matchId}/launch`, { method: "POST", token: teacher.body.token, body: { sessionCode: officialRoom.body.session.sessionCode } });
  assert.equal(relaunch.response.status, 409);
  const addAfterBracket = await api(`/api/tournaments/${id}/teams`, { method: "POST", token: teacher.body.token, body: { teamName: "Late Team", schoolName: "Late School", roster: [{ displayName: "Captain" }] } });
  assert.equal(addAfterBracket.response.status, 409);
  const regenerate = await api(`/api/tournaments/${id}/bracket`, { method: "POST", token: teacher.body.token });
  assert.equal(regenerate.response.status, 409);
  const publicAfterRelease = await api<{ studyPack: { items: Array<{ term: string; correctChoice?: string }> } }>(`/api/tournament-study/${id}`);
  assert.equal(publicAfterRelease.response.status, 200);
  assert.equal(publicAfterRelease.body.studyPack.items[0]?.term, "adapt");
  assert.equal("correctChoice" in (publicAfterRelease.body.studyPack.items[0] ?? {}), false);

  const closedRegistration = await api<{ tournament: { id: string } }>("/api/tournaments", { method: "POST", token: teacher.body.token, body: {
    title: "Closed Registration Cup",
    level: "SCHOOL_VS_SCHOOL",
    tournamentAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    registrationDeadline: new Date(Date.now() - 86_400_000).toISOString(),
    studyPackReleaseAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    maximumTeams: 2,
    quizSetId: quiz.body.quizSet.id,
    studyItems: [{ term: "deadline" }]
  } });
  assert.equal(closedRegistration.response.status, 201);
  const closedPublished = await api(`/api/tournaments/${closedRegistration.body.tournament.id}/publish`, { method: "POST", token: teacher.body.token });
  assert.equal(closedPublished.response.status, 200);
  const closedInvitation = await api(`/api/tournaments/${closedRegistration.body.tournament.id}/invitations`, { method: "POST", token: teacher.body.token });
  assert.equal(closedInvitation.response.status, 409);
});
