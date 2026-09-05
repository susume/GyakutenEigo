import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import type { TeacherUser } from "@quizstrike/shared";
import { createSpeakingProviders } from "./speakingProviders.js";
import { createSpeakingRouteState, registerSpeakingRoutes } from "./routes/speakingRoutes.js";

const teacher: TeacherUser = { id: "classroom-owner", name: "Classroom owner", email: "owner@example.test", role: "teacher" };

test("40 students can join one classroom concurrently and the teacher roster stays authoritative", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  let idCounter = 0;
  const requireTeacher = (req: Request & { user?: TeacherUser }, res: Response, next: NextFunction) => {
    if (req.header("x-teacher") !== teacher.id) {
      res.status(401).json({ error: "Teacher login required." });
      return;
    }
    req.user = teacher;
    next();
  };
  registerSpeakingRoutes(app, {
    requireTeacher,
    now: () => "2026-09-05T00:00:00.000Z",
    id: () => `classroom-reliability-${++idCounter}`,
    state,
    providers: createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" }),
    allowTextInput: true,
    sessionLifetimeSeconds: 10 * 60
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async <T>(path: string, options: { method?: string; teacher?: string; body?: unknown } = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    return { response, body: text ? JSON.parse(text) as T : {} as T };
  };

  try {
    // A token-shaped string is not authentication. Reject before raw parsing:
    // even an oversized attacker body must receive 401, not parser 413.
    const forged = await fetch(`${baseUrl}/api/speaking/sessions/unknown/turn`, {
      method: "POST",
      headers: { "content-type": "audio/webm", "X-Speaking-Token": "forged-token" },
      body: new Uint8Array(4 * 1024 * 1024 + 1)
    });
    assert.equal(forged.status, 401);
    const activity = await api<{ activity: { id: string } }>("/api/speaking/activities", {
      method: "POST",
      teacher: teacher.id,
      body: {
        title: "Forty student practice",
        scenario: "A short classroom conversation.",
        aiRole: "Partner",
        studentRole: "Student",
        level: "beginner",
        difficulty: "easy",
        nativeLanguage: "ja",
        durationSeconds: 120,
        identifierMode: "nickname",
        targetExpressions: ["Hello."],
        rubric: [{ id: "communication", name: "Communication", description: "Communicates a clear idea.", enabled: true }]
      }
    });
    const launched = await api<{ session: { id: string; joinCode: string } }>(`/api/speaking/activities/${activity.body.activity.id}/sessions`, { method: "POST", teacher: teacher.id });
    const joined = await Promise.all(Array.from({ length: 40 }, (_, index) => api<{ participant: { id: string }; session: { id: string }; token: string }>("/api/speaking/join", {
      method: "POST",
      body: { code: launched.body.session.joinCode, identifier: `Student ${index + 1}`, requestId: `classroom-${index + 1}` }
    })));

    assert.ok(joined.every((item) => item.response.status === 201));
    assert.equal(new Set(joined.map((item) => item.body.participant.id)).size, 40);
    assert.equal(new Set(joined.map((item) => item.body.session.id)).size, 1);
    assert.equal(new Set(joined.map((item) => item.body.token)).size, 40);

    const duplicate = await api<{ code: string; participantId: string }>("/api/speaking/join", {
      method: "POST",
      body: { code: launched.body.session.joinCode, identifier: "Student 1", requestId: "classroom-1" }
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.code, "SPEAKING_JOIN_ALREADY_COMPLETED");
    assert.equal(duplicate.body.participantId, joined[0]?.body.participant.id);

    const roster = await api<{ counts: { joined: number }; items: unknown[] }>(`/api/speaking/sessions/${launched.body.session.id}/roster`, { teacher: teacher.id });
    assert.equal(roster.response.status, 200);
    assert.equal(roster.body.counts.joined, 40);
    assert.equal(roster.body.items.length, 40);

    const invalidStatuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const invalid = await api("/api/speaking/join", { method: "POST", body: { code: "ZZZZZZ", identifier: "Unknown" } });
      invalidStatuses.push(invalid.response.status);
      if (attempt === 10) {
        assert.equal(invalid.response.status, 429);
        assert.equal((invalid.body as { code?: string }).code, "SPEAKING_JOIN_RATE_LIMITED");
        assert.ok(invalid.response.headers.get("retry-after"));
      }
    }
    assert.deepEqual(invalidStatuses.slice(0, 10), Array.from({ length: 10 }, () => 404));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
