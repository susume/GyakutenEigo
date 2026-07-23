import { expect, test, type APIRequestContext } from "@playwright/test";

type ClassroomFixture = {
  code: string;
  teacherToken: string;
};

const createClassroom = async (request: APIRequestContext): Promise<ClassroomFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: {
      name: "Browser Test Teacher",
      email: `browser-${suffix}@example.test`,
      password: "classroom-pass"
    }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${token}` };

  const quiz = await request.post("/api/quiz-sets", {
    headers: authorization,
    data: { title: `Browser Quiz ${suffix}` }
  });
  expect(quiz.status()).toBe(201);
  const { quizSet } = await quiz.json() as { quizSet: { id: string } };

  const question = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
    headers: authorization,
    data: {
      prompt: "Which answer is correct?",
      choiceA: "This one",
      choiceB: "Not this one",
      choiceC: "Still no",
      choiceD: "Nope",
      correctChoice: "A"
    }
  });
  expect(question.status()).toBe(201);

  const created = await request.post("/api/sessions", {
    headers: authorization,
    data: {
      quizSetId: quizSet.id,
      settings: {
        gameMode: "classic",
        maxPlayers: 4,
        roundDurationSeconds: 120,
        characterCustomization: {
          enabled: true,
          uploadsEnabled: false,
          aiEnabled: false,
          presetsOnly: false,
          persistAcrossSessions: false
        }
      }
    }
  });
  expect(created.status()).toBe(201);
  const { session } = await created.json() as { session: { sessionCode: string } };
  return { code: session.sessionCode, teacherToken: token };
};

test("student customizes, reloads, and receives match start over Socket.IO", async ({ page, request }, testInfo) => {
  const classroom = await createClassroom(request);
  const browserStartedAt = performance.now();
  const socketFrameSizes: number[] = [];
  const socketFrames: string[] = [];
  const pageErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("websocket", (webSocket) => {
    if (!webSocket.url().includes("socket.io")) return;
    webSocket.on("framereceived", ({ payload }) => {
      const text = typeof payload === "string" ? payload : payload.toString("utf8");
      socketFrameSizes.push(Buffer.byteLength(text));
      socketFrames.push(text);
    });
  });

  await page.goto(`/join?code=${classroom.code}`);
  await page.getByLabel("Your name").fill("Browser Student");
  await page.getByRole("button", { name: "Join", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Build Your Player" })).toBeVisible();
  const creatorReadyMs = performance.now() - browserStartedAt;
  await expect(page.getByText("1 joined", { exact: true })).toBeVisible();
  const bodyPreset = page.getByLabel("Body preset");
  const appearanceSaved = page.waitForResponse(
    (response) => response.request().method() === "PUT" && response.url().includes("/appearance")
  );
  await bodyPreset.selectOption("engineer");
  expect((await appearanceSaved).status()).toBe(200);
  const appearanceSavedMs = performance.now() - browserStartedAt;
  await expect(bodyPreset).toHaveValue("engineer");
  await expect(page.getByRole("button", { name: "Saved" })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Build Your Player" })).toBeVisible();
  await expect(page.getByLabel("Body preset")).toHaveValue("engineer");
  const restoredMs = performance.now() - browserStartedAt;

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build Your Player" })).toBeHidden();
  await expect.poll(() => socketFrames.some(
    (frame) => frame.includes("session_state") && frame.includes('"status":"active"')
  )).toBe(true);
  const matchStartedMs = performance.now() - browserStartedAt;

  const largestSocketFrameBytes = Math.max(0, ...socketFrameSizes);
  expect(socketFrameSizes.length).toBeGreaterThan(0);
  expect(largestSocketFrameBytes).toBeLessThan(128 * 1024);
  expect(socketFrames.some((frame) => frame.includes("data:image"))).toBe(false);
  expect(pageErrors).toEqual([]);

  await testInfo.attach("classroom-browser-telemetry.json", {
    body: JSON.stringify({
      socketFramesObserved: socketFrameSizes.length,
      largestSocketFrameBytes,
      creatorReadyMs: Math.round(creatorReadyMs),
      appearanceSavedMs: Math.round(appearanceSavedMs),
      restoredMs: Math.round(restoredMs),
      matchStartedMs: Math.round(matchStartedMs),
      pageErrors
    }, null, 2),
    contentType: "application/json"
  });
  await page.goto("about:blank");
});
