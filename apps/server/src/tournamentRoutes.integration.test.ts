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
  const tournament = await api<{ tournament: { id: string } }>("/api/tournaments", { method: "POST", token: teacher.body.token, body: {
    title: "Midori Schools Cup",
    description: "A test event",
    level: "SCHOOL_VS_SCHOOL",
    tournamentAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    registrationDeadline: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    studyPackReleaseAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    maximumTeams: 2,
    quizSetId: quiz.body.quizSet.id,
    studyItems: [{ term: "adapt", meaning: "change", example: "Adapt to the map." }]
  } });
  assert.equal(tournament.response.status, 201);
  const id = tournament.body.tournament.id;
  const publicBeforeRelease = await api(`/api/tournament-study/${id}`);
  assert.equal(publicBeforeRelease.response.status, 403);
  const otherTeacher = await api<{ token: string }>("/api/auth/signup", { method: "POST", body: { name: "Another Teacher", email: `other-${Date.now()}-${counter}@example.test`, password: "classroom-pass" } });
  const forbiddenEdit = await api(`/api/tournaments/${id}`, { method: "PATCH", token: otherTeacher.body.token, body: { title: "Hijacked" } });
  assert.equal(forbiddenEdit.response.status, 403);
  const published = await api(`/api/tournaments/${id}/publish`, { method: "POST", token: teacher.body.token });
  assert.equal(published.response.status, 200);
  for (const name of ["North Stars", "South Stars"]) {
    const team = await api(`/api/tournaments/${id}/teams`, { method: "POST", token: teacher.body.token, body: { teamName: name, schoolName: `${name} School`, roster: [{ displayName: "Captain" }] } });
    assert.equal(team.response.status, 201);
  }
  const bracket = await api<{ matches: Array<{ status: string }> }>(`/api/tournaments/${id}/bracket`, { method: "POST", token: teacher.body.token });
  assert.equal(bracket.response.status, 201);
  assert.equal(bracket.body.matches.length, 1);
  const released = await api(`/api/tournaments/${id}/study-pack/release`, { method: "POST", token: teacher.body.token });
  assert.equal(released.response.status, 200);
  const publicAfterRelease = await api<{ studyPack: { items: Array<{ term: string; correctChoice?: string }> } }>(`/api/tournament-study/${id}`);
  assert.equal(publicAfterRelease.response.status, 200);
  assert.equal(publicAfterRelease.body.studyPack.items[0]?.term, "adapt");
  assert.equal("correctChoice" in (publicAfterRelease.body.studyPack.items[0] ?? {}), false);
});
