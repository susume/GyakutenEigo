import assert from "node:assert/strict";
import test from "node:test";
import express, { type Request } from "express";
import type { TeacherUser } from "@quizstrike/shared";
import { createCompetitionState, registerCompetitionRoutes } from "./routes/competitionRoutes.js";

const organizer: TeacherUser = { id: "teacher-route-test", name: "Coach Route", email: "route@example.com", role: "teacher" };
const now = new Date("2026-08-02T00:00:00.000Z");

test("competition routes expose public records, lock study packs, register teams, and hide rosters", async () => {
  const app = express();
  app.use(express.json());
  const state = createCompetitionState({ id: "official-quizstrike", name: "QuizStrike Classroom" }, now);
  const requireTeacher = (req: Request & { user?: TeacherUser }, res: express.Response, next: express.NextFunction) => {
    if (req.header("x-test-auth") !== "teacher") {
      res.status(401).json({ error: "Teacher login required." });
      return;
    }
    req.user = organizer;
    next();
  };
  registerCompetitionRoutes(app, {
    state,
    now: () => now.toISOString(),
    requireTeacher,
    getBearerUser: (req) => req.header("x-test-auth") === "teacher" ? organizer : undefined
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const listing = await fetch(`${baseUrl}/api/competitions`).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(listing.status, 200);
    assert.equal(listing.body.featured.slug, "classroom-cup-2026");
    assert.equal(listing.body.competitions.length, 3);

    const privateCompetition = [...state.competitions.values()].find((competition) => competition.slug === "east-vs-west-schools");
    if (privateCompetition) {
      privateCompetition.visibility = "INVITATION_ONLY";
      privateCompetition.slug = "private-school-series";
    }
    const privateResponse = await fetch(`${baseUrl}/api/competitions/private-school-series`);
    assert.equal(privateResponse.status, 404);

    const detail = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026`).then((response) => response.json());
    assert.equal(detail.competition.status, "REGISTRATION_OPEN");
    assert.equal(detail.competition.studyPack, undefined);

    const locked = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026/study-pack`);
    assert.equal(locked.status, 403);

    const unauthorized = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamName: "North Stars" }) });
    assert.equal(unauthorized.status, 401);

    const registrationBody = { teamName: "North Stars", affiliation: "North School", activePlayers: [{ id: "p1", displayName: "Mika", playerKey: "student-1" }], substitutePlayers: [] };
    const registered = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026/teams`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-auth": "teacher" }, body: JSON.stringify(registrationBody) });
    assert.equal(registered.status, 201);
    const registeredDetail = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026`).then((response) => response.json());
    assert.equal("activePlayers" in registeredDetail.competition.teams[0], false);

    const duplicate = await fetch(`${baseUrl}/api/competitions/classroom-cup-2026/teams`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-auth": "teacher" }, body: JSON.stringify({ ...registrationBody, teamName: "South Stars", affiliation: "South School" }) });
    assert.equal(duplicate.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
