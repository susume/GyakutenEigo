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

test("teacher and student Speaking Practice screens use the connected mock API", async ({ browser, request }, testInfo) => {
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
  await expect(teacherPage).toHaveURL(/\/speaking\/activity\/[^/]+$/);
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
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => {
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      oscillator.connect(destination); oscillator.start(); await context.resume();
      return destination.stream;
    } } });
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
  const responsiveViewports = [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 }
  ];
  for (const viewport of responsiveViewports) {
    await studentPage.setViewportSize(viewport);
    const bounds = await studentPage.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return undefined;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        mic: read(".speaking-student-mic"),
        finish: read(".speaking-student-timer button"),
        help: read(".speaking-student-help-button"),
        transcript: read(".speaking-transcript-card")
      };
    });
    expect(bounds.mic).toBeTruthy();
    expect(bounds.finish).toBeTruthy();
    expect(bounds.help).toBeTruthy();
    expect(bounds.transcript).toBeTruthy();
    for (const control of [bounds.mic, bounds.finish, bounds.help]) {
      expect(control!.left).toBeGreaterThanOrEqual(0);
      expect(control!.right).toBeLessThanOrEqual(viewport.width + 1);
      expect(control!.bottom).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(bounds.transcript!.height).toBeGreaterThan(100);
    await studentPage.getByRole("button", { name: "Tap to speak", exact: true }).click();
    const stopSpeakingAtViewport = studentPage.getByRole("button", { name: "Stop speaking", exact: true });
    await expect(stopSpeakingAtViewport).toBeVisible();
    const stopBoundsAtViewport = await stopSpeakingAtViewport.boundingBox();
    expect(stopBoundsAtViewport).toBeTruthy();
    expect(stopBoundsAtViewport!.x).toBeGreaterThanOrEqual(0);
    expect(stopBoundsAtViewport!.x + stopBoundsAtViewport!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(stopBoundsAtViewport!.y).toBeGreaterThanOrEqual(0);
    expect(stopBoundsAtViewport!.y + stopBoundsAtViewport!.height).toBeLessThanOrEqual(viewport.height + 1);
    await stopSpeakingAtViewport.click();
    await expect(studentPage.getByRole("button", { name: "Tap to speak", exact: true })).toBeEnabled({ timeout: 15_000 });
    await studentPage.screenshot({ path: testInfo.outputPath(`speaking-${viewport.width}x${viewport.height}.png`), fullPage: false });
  }
  await studentPage.evaluate(() => {
    document.documentElement.style.zoom = "1.25";
  });
  const zoomedMic = await studentPage.locator(".speaking-student-mic").boundingBox();
  const zoomViewport = await studentPage.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(zoomedMic).toBeTruthy();
  expect(zoomedMic!.x).toBeGreaterThanOrEqual(0);
  expect(zoomedMic!.x + zoomedMic!.width).toBeLessThanOrEqual(zoomViewport.width + 1);
  expect(zoomedMic!.y).toBeGreaterThanOrEqual(0);
  expect(zoomedMic!.y + zoomedMic!.height).toBeLessThanOrEqual(zoomViewport.height + 1);
  await studentPage.evaluate(() => { document.documentElement.style.zoom = ""; });
  const tapToSpeak = studentPage.getByRole("button", { name: "Tap to speak", exact: true });
  await tapToSpeak.focus();
  await expect(tapToSpeak).toBeFocused();
  await studentPage.keyboard.press("Enter");
  const stopSpeaking = studentPage.getByRole("button", { name: "Stop speaking", exact: true });
  await expect(stopSpeaking).toBeVisible();
  const stopBounds = await stopSpeaking.boundingBox();
  expect(stopBounds).toBeTruthy();
  expect(stopBounds!.x).toBeGreaterThanOrEqual(0);
  expect(stopBounds!.x + stopBounds!.width).toBeLessThanOrEqual(390 + 1);
  expect(stopBounds!.y).toBeGreaterThanOrEqual(0);
  expect(stopBounds!.y + stopBounds!.height).toBeLessThanOrEqual(844 + 1);
  await stopSpeaking.focus();
  await studentPage.keyboard.press("Enter");
  await expect(studentPage.locator(".speaking-transcript-card")).toContainText("practice this conversation", { timeout: 15_000 });
  await studentPage.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(studentPage.getByRole("heading", { name: "今回の結果" })).toBeVisible({ timeout: 15_000 });

  await teacherPage.goto(`/quiz-strike/teacher/speaking/activity/${activityId}/results?sessionId=${encodeURIComponent(session!.id)}`);
  await expect(teacherPage.locator(".speaking-results-table-row").filter({ hasText: "Aki" })).toContainText("Completed");
  await expect(teacherPage.locator(".speaking-table-score")).not.toHaveText("—");

  await studentContext.close();
  await teacherContext.close();
});

test("Speaking Practice recovers each failed operation without cross-retrying", async ({ browser, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: { name: "Speaking Recovery Teacher", email: `speaking-recovery-${suffix}@example.test`, password: "speaking-pass" }
  });
  expect(signup.status()).toBe(201);
  const { token: teacherToken } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${teacherToken}` };
  const activityResponse = await request.post("/api/speaking/activities", {
    headers: authorization,
    data: {
      title: "Recovery conversation",
      scenario: "The student practices asking a classmate for help.",
      aiRole: "Classmate",
      studentRole: "Student",
      level: "beginner",
      difficulty: "easy",
      nativeLanguage: "ja",
      durationSeconds: 120,
      identifierMode: "nickname",
      targetExpressions: ["Could you help me?", "I would like to practice.", "Thank you.", "See you.", "Could you repeat that?", "One more question."],
      rubric: [{ id: "communication", name: "Communication", description: "Communicates a clear idea.", enabled: true }]
    }
  });
  expect(activityResponse.status()).toBe(201);
  const { activity } = await activityResponse.json() as { activity: { id: string } };
  const sessionResponse = await request.post(`/api/speaking/activities/${activity.id}/sessions`, { headers: authorization, data: {} });
  expect(sessionResponse.status()).toBe(201);
  const { session } = await sessionResponse.json() as { session: { id: string; joinCode: string } };
  const started = await request.post(`/api/speaking/sessions/${session.id}/start-session`, { headers: authorization, data: {} });
  expect(started.status()).toBe(200);

  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await deniedPage.addInitScript(() => {
    let microphoneAllowed = false;
    const fakeStream = { getTracks: () => [{ stop: () => undefined }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (!microphoneAllowed) throw new DOMException("Permission denied", "NotAllowedError");
          return fakeStream;
        }
      }
    });
    (window as typeof window & { __allowSpeakingMicrophone?: () => void }).__allowSpeakingMicrophone = () => { microphoneAllowed = true; };
  });
  await deniedPage.goto(`/speak/join/${session.joinCode}`);
  await deniedPage.getByLabel("Nickname or student number").fill("Denied then recovered");
  await deniedPage.getByRole("button", { name: "Join session", exact: true }).click();
  await deniedPage.getByRole("button", { name: "Start Speaking", exact: true }).click();
  await expect(deniedPage.getByRole("button", { name: "Retry microphone", exact: true })).toBeVisible();
  await expect(deniedPage.getByRole("alert")).toContainText("Microphone permission was denied");
  await deniedPage.evaluate(() => (window as typeof window & { __allowSpeakingMicrophone?: () => void }).__allowSpeakingMicrophone?.());
  await deniedPage.getByRole("button", { name: "Retry microphone", exact: true }).click();
  await expect(deniedPage.getByRole("alert")).toContainText("could not measure input");
  await expect(deniedPage.getByLabel("Microphone input detected", { exact: true })).toHaveCount(0);
  await deniedPage.getByRole("button", { name: "Continue without input test", exact: true }).click();
  await expect(deniedPage).toHaveURL(new RegExp(`/speak/session/${session.id}$`));
  await deniedContext.close();

  const context = await browser.newContext();
  await context.grantPermissions(["microphone"], { origin: "http://127.0.0.1:4173" });
  const page = await context.newPage();
  await page.addInitScript(() => {
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
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: () => undefined, speak: (utterance: { onend?: () => void }) => setTimeout(() => utterance.onend?.(), 0) } });
  });
  try {
    await page.goto(`/speak/join/${session.joinCode}`);
    await page.getByLabel("Nickname or student number").fill("Recovery student");
    await page.getByRole("button", { name: "Join session", exact: true }).click();
    await page.getByRole("button", { name: "Start Speaking", exact: true }).click();
    await page.getByRole("button", { name: "Continue without input test", exact: true }).click();
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "One more question.", exact: true })).toBeVisible();

    let helpAttempts = 0;
    await page.route(`**/api/speaking/sessions/${session.id}/help`, async (route) => {
      helpAttempts += 1;
      if (helpAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SPEAKING_HELP_UNAVAILABLE", error: "Help service temporarily unavailable." }) });
        return;
      }
      await route.continue();
    });
    await page.locator(".speaking-student-help-button").click();
    await expect(page.getByRole("alert")).toContainText("Help service temporarily unavailable.");
    await expect(page.getByRole("button", { name: "Retry Help", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tap to speak", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Retry Help", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("You can try this");
    const closeHelp = page.getByRole("button", { name: "Close help", exact: true });
    await closeHelp.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Got it", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeHelp).toBeFocused();
    expect(helpAttempts).toBe(2);
    await page.getByRole("button", { name: "Got it", exact: true }).click();

    let turnAttempts = 0;
    await page.route(`**/api/speaking/sessions/${session.id}/turn`, async (route) => {
      turnAttempts += 1;
      if (turnAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Turn service temporarily unavailable." }) });
        return;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Tap to speak", exact: true }).click();
    await page.getByRole("button", { name: "Stop speaking", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry this turn", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry this turn", exact: true }).click();
    await expect(page.locator(".speaking-transcript-card")).toContainText("practice this conversation", { timeout: 15_000 });
    expect(turnAttempts).toBe(2);

    let finishAttempts = 0;
    let pendingResultShown = false;
    await page.route(`**/api/speaking/sessions/${session.id}/finish`, async (route) => {
      finishAttempts += 1;
      if (finishAttempts === 1) {
        const response = await route.fetch();
        await response.body();
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Evaluation service temporarily unavailable." }) });
        return;
      }
      await route.continue();
    });
    await page.route(`**/api/speaking/results/*`, async (route) => {
      if (pendingResultShown) {
        await route.continue();
        return;
      }
      pendingResultShown = true;
      const response = await route.fetch();
      const payload = await response.json() as { result: Record<string, unknown>; evaluationStatus?: string };
      const result = payload.result as { participant: Record<string, unknown> };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...payload, evaluationStatus: "running", result: { ...result, participant: { ...result.participant, status: "evaluating" }, evaluation: undefined } })
      });
    });
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check evaluation", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Check evaluation", exact: true }).click();
    expect(turnAttempts).toBe(2);
    await expect(page.getByRole("heading", { name: "Your speaking practice is finished.", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "今回の結果" })).toBeVisible({ timeout: 15_000 });
    expect(finishAttempts).toBe(2);
    expect(pendingResultShown).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "今回の結果" })).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.close();
  }
});
