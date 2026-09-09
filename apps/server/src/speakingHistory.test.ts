import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { DEFAULT_SPEAKING_RUBRIC, speakingTeacherDate, type SpeakingSession, type SpeakingReportSummary, type TeacherUser } from "@quizstrike/shared";
import { InMemorySpeakingRepository, createInMemorySpeakingState } from "./speakingRepository.js";
import { registerSpeakingRoutes } from "./routes/speakingRoutes.js";
import { createSpeakingProviders } from "./speakingProviders.js";

test("Speaking history HTTP boundaries preserve launch context and protect live classrooms", async () => {
  const repository = new InMemorySpeakingRepository(createInMemorySpeakingState());
  const now = "2026-09-09T15:30:00.000Z";
  assert.equal(speakingTeacherDate(now), "2026-09-10");
  const input = { title: "Directions", scenario: "Give directions around town.", aiRole: "Tourist", studentRole: "Local", level: "elementary" as const, difficulty: "normal" as const, nativeLanguage: "ja" as const, durationSeconds: 120, identifierMode: "nickname" as const, targetExpressions: ["Turn left."], rubric: DEFAULT_SPEAKING_RUBRIC };
  const activity = await repository.createActivity("owner", input, "test", now);
  const otherActivity = await repository.createActivity("other", input, "other-test", now);
  await repository.createSet("owner", { name: "Original Set" }, "set", now);
  await repository.createSet("owner", { name: "Unrelated" }, "unrelated", now);
  await repository.createSet("other", { name: "Other owner" }, "foreign", now);
  await repository.addSetActivity("other", "foreign", otherActivity.id);
  const app = express();
  app.use(express.json());
  let id = 0;
  registerSpeakingRoutes(app, {
    repository, now: () => now, id: () => `http-${++id}`,
    providers: createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" }),
    requireTeacher: (req, res, next) => {
      const teacher = req.header("x-teacher");
      if (!teacher) { res.status(401).end(); return; }
      (req as typeof req & { user: TeacherUser }).user = { id: teacher, name: teacher, email: `${teacher}@example.test`, role: "teacher" };
      next();
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/speaking`;
  const api = (path: string, method = "GET", body?: unknown, teacher = "owner") => fetch(base + path, { method, headers: { "x-teacher": teacher, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const launch = async (setId?: string) => {
    const response = await api("/activities/test/sessions", "POST", setId ? { setId } : {});
    assert.equal(response.status, 201);
    return (await response.json() as { session: SpeakingSession }).session;
  };
  const reports = async () => (await (await api("/reports")).json() as { items: SpeakingReportSummary[] }).items;
  const participant = async (session: SpeakingSession, name: string) => repository.createParticipant({ id: name, activity, session, tokenHash: name, displayIdentifier: name });
  try {
    const templates = await (await api("/templates")).json() as { items: Array<{ title: string; scenarioResources: { imageSrc: string } }> };
    assert.equal(templates.items.find((item) => item.title === "Asking for Directions")?.scenarioResources.imageSrc, "/assets/speaking/scenario-directions.webp");
    const beforeMembership = await launch();
    await participant(beforeMembership, "PRE_MEMBERSHIP");
    await repository.updateSession(beforeMembership.id, { status: "ended", endedAt: now });
    await repository.addSetActivity("owner", "set", activity.id);
    const direct = await launch();
    await participant(direct, "DIRECT_RUN");
    await repository.updateSession(direct.id, { status: "ended", endedAt: now });
    for (const setId of ["foreign", "missing", "unrelated"]) assert.equal((await api("/activities/test/sessions", "POST", { setId })).status, 404);
    assert.equal((await api("/activities/test/sessions", "POST", { setId: 42 })).status, 400);
    assert.equal((await api("/activities/other-test/sessions", "POST", { setId: "set" })).status, 404);
    const historical = await launch("set");
    await participant(historical, "HISTORICAL_RUN");
    await repository.updateSession(historical.id, { status: "ended", endedAt: now });
    const expired = await launch("set");
    await participant(expired, "EXPIRED_RUN");
    await repository.updateSession(expired.id, { status: "expired", endedAt: now });
    const live = await launch("set");
    await participant(live, "LIVE_RUN");
    for (const status of ["ready", "active", "paused"] as const) {
      await repository.updateSession(live.id, { status });
      assert.equal((await reports()).some((item) => item.session.id === live.id), false);
      assert.equal((await api(`/sessions/${live.id}`, "DELETE")).status, 409);
      assert.equal((await repository.getSession(live.id))?.session.status, status);
      assert.equal((await repository.getParticipantAccessByTokenHash("LIVE_RUN"))?.participant.id, "LIVE_RUN");
    }
    assert.equal((await api(`/sessions/${live.id}/resume`, "POST")).status, 200);
    assert.equal((await api(`/sessions/${historical.id}`, "DELETE", undefined, "other")).status, 404);
    await repository.updateSet("owner", "set", { name: "Renamed Set" }, now);
    await repository.removeSetActivity("owner", "set", activity.id);
    await repository.addSetActivity("owner", "unrelated", activity.id);
    const summary = (await reports()).find((item) => item.session.id === historical.id)!;
    assert.equal(summary.setMemberships[0]?.name, "Original Set");
    assert.equal(summary.session.speakingSetId, "set");
    const csvResponse = await api("/sets/set/report.csv");
    assert.match(csvResponse.headers.get("content-disposition")!, /2026-09-10/);
    const csv = await csvResponse.text();
    for (const value of ["HISTORICAL_RUN", "EXPIRED_RUN", "Original Set", "2026-09-10"]) assert.ok(csv.includes(value), value);
    for (const value of ["PRE_MEMBERSHIP", "DIRECT_RUN", "LIVE_RUN", "Renamed Set"]) assert.ok(!csv.includes(value), value);
    const empty = await (await api("/sets/unrelated/report.csv")).text();
    assert.equal(empty.trim().split(/\r?\n/u).length, 1);
    assert.equal((await api("/sets/set/report.csv", "GET", undefined, "other")).status, 404);
    await repository.deleteSet("owner", "set");
    assert.equal((await reports()).find((item) => item.session.id === historical.id)?.setMemberships[0]?.name, "Original Set");
    assert.match(await (await api(`/sessions/${historical.id}/report.csv`)).text(), /Original Set/);
    await repository.archiveActivity("owner", activity.id);
    assert.equal((await api("/activities/test/sessions", "POST")).status, 409);
    assert.equal((await api("/activities/test", "PATCH", input)).status, 404);
    assert.equal(await repository.addSetActivity("owner", "unrelated", activity.id), undefined);
    assert.equal((await api("/sets/unrelated/activities/test", "POST")).status, 404);
    assert.ok((await reports()).some((item) => item.session.id === historical.id));
    for (const session of [historical, expired]) assert.equal((await api(`/sessions/${session.id}`, "DELETE")).status, 200);
    assert.ok(await repository.getActivity(activity.id));
    assert.equal(await repository.getParticipantAccessByTokenHash("HISTORICAL_RUN"), undefined);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
