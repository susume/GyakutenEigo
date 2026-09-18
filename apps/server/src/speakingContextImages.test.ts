import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import sharp from "sharp";
import { type TeacherUser } from "@quizstrike/shared";
import { createSpeakingProviders } from "./speakingProviders.js";
import { processSpeakingContextImage, SPEAKING_CONTEXT_IMAGE_LIMITS, SpeakingContextImageProcessingError } from "./speakingContextImages.js";
import { createSpeakingRouteState, registerSpeakingRoutes } from "./routes/speakingRoutes.js";

const owner: TeacherUser = { id: "owner", name: "Owner", email: "owner@example.test", role: "teacher" };
const other: TeacherUser = { id: "other", name: "Other", email: "other@example.test", role: "teacher" };

const imageInput = {
  title: "Ordering lunch",
  scenario: "The student orders lunch from a menu.",
  aiRole: "Server",
  studentRole: "Customer",
  level: "elementary",
  difficulty: "normal",
  nativeLanguage: "ja",
  durationSeconds: 180,
  identifierMode: "nickname",
  mode: "assessment",
  targetExpressions: ["I'd like ..."],
  rubric: [{ id: "task", name: "Task achievement", description: "Orders lunch clearly.", enabled: true }]
} as const;

test("context image processing validates formats and produces bounded WebP output", async () => {
  const source = await sharp({
    create: { width: 2200, height: 1400, channels: 3, background: { r: 50, g: 130, b: 210 } }
  }).png().toBuffer();
  const processed = await processSpeakingContextImage(source, "image/png");
  assert.equal(processed.mimeType, "image/webp");
  assert.ok(processed.byteLength <= SPEAKING_CONTEXT_IMAGE_LIMITS.maxOutputBytes);
  assert.equal(processed.width, 1280);
  assert.equal(processed.height, 815);
  assert.equal((await sharp(processed.bytes).metadata()).format, "webp");

  await assert.rejects(
    processSpeakingContextImage(Buffer.alloc(SPEAKING_CONTEXT_IMAGE_LIMITS.maxInputBytes + 1), "image/png"),
    (error: unknown) => error instanceof SpeakingContextImageProcessingError && error.code === "SPEAKING_CONTEXT_IMAGE_TOO_LARGE"
  );
  await assert.rejects(
    processSpeakingContextImage(Buffer.from("not an image"), "image/png"),
    (error: unknown) => error instanceof SpeakingContextImageProcessingError && error.code === "SPEAKING_CONTEXT_IMAGE_INVALID"
  );
  await assert.rejects(
    processSpeakingContextImage(source, "image/gif"),
    (error: unknown) => error instanceof SpeakingContextImageProcessingError && error.code === "SPEAKING_CONTEXT_IMAGE_UNSUPPORTED"
  );
});

test("context image API enforces ownership and keeps soft-deleted assets for historical snapshots", async () => {
  const app = express();
  app.use(express.json());
  const state = createSpeakingRouteState();
  let counter = 0;
  const teachers = new Map([[owner.id, owner], [other.id, other]]);
  const requireTeacher = (req: Request & { user?: TeacherUser }, res: Response, next: NextFunction) => {
    const teacher = teachers.get(String(req.header("x-teacher") ?? ""));
    if (!teacher) {
      res.status(401).json({ error: "Teacher login required." });
      return;
    }
    req.user = teacher;
    next();
  };
  registerSpeakingRoutes(app, {
    requireTeacher,
    now: () => "2026-09-18T00:00:00.000Z",
    id: () => `context-image-test-${++counter}`,
    state,
    providers: createSpeakingProviders({ NODE_ENV: "test", SPEAKING_MOCK_MODE: "true" }),
    allowTextInput: true
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const image = await sharp({
    create: { width: 640, height: 420, channels: 3, background: { r: 240, g: 210, b: 160 } }
  }).jpeg().toBuffer();
  const request = async (path: string, options: { method?: string; teacher?: string; body?: BodyInit; contentType?: string } = {}) => {
    const headers = new Headers();
    if (options.teacher) headers.set("x-teacher", options.teacher);
    if (options.contentType) headers.set("content-type", options.contentType);
    const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body });
    const contentType = response.headers.get("content-type") ?? "";
    return { response, json: contentType.includes("application/json") ? await response.json() as Record<string, any> : undefined };
  };

  try {
    const uploaded = await request("/api/speaking/context-images", { method: "POST", teacher: owner.id, contentType: "image/jpeg", body: new Blob([image], { type: "image/jpeg" }) });
    assert.equal(uploaded.response.status, 201);
    const uploadedImage = uploaded.json?.image as { id: string; url: string; mimeType: string };
    assert.match(uploadedImage.id, /^[A-Za-z0-9_-]{32,}$/u);
    assert.equal(uploadedImage.mimeType, "image/webp");

    const created = await request("/api/speaking/activities", { method: "POST", teacher: owner.id, contentType: "application/json", body: JSON.stringify({
      ...imageInput,
      context: { assetId: uploadedImage.id, imageUrl: uploadedImage.url, type: "photo", alt: "Lunch menu" },
      scenarioResources: { studentGoal: "Order one lunch item." }
    }) });
    assert.equal(created.response.status, 201);
    const activityId = (created.json?.activity as { id: string }).id;
    const launched = await request(`/api/speaking/activities/${activityId}/sessions`, { method: "POST", teacher: owner.id, contentType: "application/json", body: JSON.stringify({}) });
    assert.equal(launched.response.status, 201);
    const sessionId = (launched.json?.session as { id: string }).id;
    assert.equal(state.sessions.get(sessionId)?.activitySnapshot.context?.assetId, uploadedImage.id);

    const forbidden = await request(`/api/speaking/context-images/${encodeURIComponent(uploadedImage.id)}`, { method: "DELETE", teacher: other.id });
    assert.equal(forbidden.response.status, 404);
    const removed = await request(`/api/speaking/context-images/${encodeURIComponent(uploadedImage.id)}`, { method: "DELETE", teacher: owner.id });
    assert.equal(removed.response.status, 204);

    const historicalImage = await request(uploadedImage.url);
    assert.equal(historicalImage.response.status, 200);
    assert.equal(historicalImage.response.headers.get("content-type"), "image/webp");
    assert.ok(Number(historicalImage.response.headers.get("content-length")) > 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
