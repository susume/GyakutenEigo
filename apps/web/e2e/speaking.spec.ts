import { expect, test } from "@playwright/test";

test("logged-out teacher returns to the Speaking builder after existing auth", async ({ browser, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `speaking-return-${suffix}@example.test`;
  const signup = await request.post("/api/auth/signup", {
    data: { name: "Speaking Return Teacher", email, password: "speaking-pass" }
  });
  expect(signup.status()).toBe(201);

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/speak/teacher/create");
    await expect(page.getByRole("heading", { name: "Sign in to GyakutenEigo" })).toBeVisible();
    await expect(page).toHaveURL(/\/quiz-strike\/teacher\/speaking\/create$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("speaking-pass");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/quiz-strike\/teacher\/speaking\/create$/);
    await expect(page.getByRole("heading", { name: "Create an activity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Speaking Practice", exact: true })).toHaveClass(/active/);
    await page.getByRole("button", { name: "Speaking Practice", exact: true }).click();
    await expect(page).toHaveURL(/\/quiz-strike\/teacher\/speaking$/);
    await expect(page.getByRole("heading", { name: "Speaking Practice", exact: true })).toBeVisible();
    await expect(page.locator(".speaking-embedded-teacher .speaking-teacher-sidebar")).toBeHidden();
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/quiz-strike\/teacher\/home$/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await page.getByRole("button", { name: "Speaking Practice", exact: true }).click();
    await page.getByRole("complementary", { name: "Teacher sections" }).getByRole("button", { name: "New activity", exact: true }).click();
    await expect(page).toHaveURL(/\/quiz-strike\/teacher\/speaking\/create$/);
    await expect(page.getByRole("heading", { name: "Create an activity" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("teacher and student Speaking Practice screens use the connected mock API", async ({ browser, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: { name: "Speaking E2E Teacher", email: `speaking-${suffix}@example.test`, password: "speaking-pass" }
  });
  expect(signup.status()).toBe(201);
  const { token: teacherToken } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${teacherToken}` };

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.addInitScript((token) => localStorage.setItem("quizstrike_token", token), teacherToken);
  await teacherPage.goto("/quiz-strike/teacher/speaking/create");
  await expect(teacherPage.getByRole("heading", { name: "Create an activity" })).toBeVisible();
  await teacherPage.getByRole("button", { name: "Create activity", exact: true }).last().click();
  const activityId = new URL(teacherPage.url()).pathname.split("/").pop()!;
  await teacherPage.goto(`/quiz-strike/teacher/speaking/activity/${activityId}/results`);
  await expect(teacherPage.getByRole("heading", { name: "No classroom sessions yet" })).toBeVisible();
  await teacherPage.getByRole("button", { name: "Open activity", exact: true }).click();
  await expect(teacherPage.getByRole("button", { name: "Launch session", exact: true })).toBeVisible();
  await teacherPage.getByRole("button", { name: "Launch session", exact: true }).click();
  await expect(teacherPage.locator(".speaking-join-code-block strong")).toBeVisible();
  const joinCode = await teacherPage.locator(".speaking-join-code-block strong").innerText();
  await teacherPage.getByRole("button", { name: "Start session", exact: true }).click();
  await expect(teacherPage.getByRole("button", { name: "Pause session", exact: true })).toBeVisible();

  const sessions = await request.get(`/api/speaking/activities/${activityId}/sessions`, { headers: authorization });
  expect(sessions.status()).toBe(200);
  const { sessions: launchedSessions } = await sessions.json() as { sessions: Array<{ id: string; joinCode: string }> };
  const session = launchedSessions.find((candidate) => candidate.joinCode === joinCode);
  expect(session).toBeTruthy();

  const studentContext = await browser.newContext();
  await studentContext.grantPermissions(["microphone"], { origin: "http://127.0.0.1:4173" });
  const studentPage = await studentContext.newPage();
  await studentPage.addInitScript(() => {
    const fakeStream = { getTracks: () => [{ stop: () => undefined }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => fakeStream } });
    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      constructor(readonly stream: unknown, readonly options?: { mimeType?: string }) {}
      start() { this.state = "recording"; }
      stop() {
        if (this.state !== "recording") return;
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["mock browser audio"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel: () => undefined,
      speak: (utterance: { onend?: () => void }) => setTimeout(() => utterance.onend?.(), 0)
    } });
  });
  await studentPage.goto(`/speak/join/${joinCode}`);
  await studentPage.getByLabel("Nickname or student number").fill("Aki");
  await studentPage.getByRole("button", { name: "Join session", exact: true }).click();
  await studentPage.getByRole("button", { name: "Start Speaking", exact: true }).click();
  await expect(studentPage.getByRole("button", { name: "Tap to speak", exact: true })).toBeEnabled();
  await studentPage.getByRole("button", { name: "Tap to speak", exact: true }).click();
  await studentPage.getByRole("button", { name: "Stop speaking", exact: true }).click();
  await expect(studentPage.locator(".speaking-transcript-preview")).toContainText("practice this conversation", { timeout: 15_000 });
  await studentPage.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(studentPage.getByRole("heading", { name: "今回の結果" })).toBeVisible({ timeout: 15_000 });

  await teacherPage.goto(`/quiz-strike/teacher/speaking/activity/${activityId}/results?sessionId=${encodeURIComponent(session!.id)}`);
  await expect(teacherPage.locator(".speaking-results-table-row").filter({ hasText: "Aki" })).toContainText("Completed");
  await expect(teacherPage.locator(".speaking-table-score")).not.toHaveText("—");

  await studentContext.close();
  await teacherContext.close();
});
