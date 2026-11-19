import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClassroom as createModeClassroom } from "./classroomFixture";

type ClassroomFixture = {
  code: string;
  teacherToken: string;
};

const createClassroom = async (
  request: APIRequestContext,
  { persistAcrossSessions = false }: { persistAcrossSessions?: boolean } = {}
): Promise<ClassroomFixture> => {
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

  for (let index = 0; index < 16; index += 1) {
    const question = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
      headers: authorization,
      data: {
        prompt: index === 15
          ? "鎌倉幕府？"
          : `Which answer is correct? Practice item ${index + 1}.`,
        choiceA: "This one",
        choiceB: "Not this one",
        choiceC: "Still no",
        choiceD: "Nope",
        correctChoice: "A",
        explanation: "正解は A です。これは答えを確認するための長めの日本語解説です。".repeat(5)
      }
    });
    expect(question.status()).toBe(201);
  }

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
          persistAcrossSessions
        }
      }
    }
  });
  expect(created.status()).toBe(201);
  const { session } = await created.json() as { session: { sessionCode: string } };
  return { code: session.sessionCode, teacherToken: token };
};

test("join route stays within the viewport and does not load app CSS", async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/join");
    await expect(page.getByPlaceholder("Player name")).toBeVisible();
    const metrics = await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>(".game-join-screen")!;
      const form = document.querySelector<HTMLElement>(".student-join-form")!;
      const input = form.querySelector<HTMLInputElement>("input")!;
      const button = form.querySelector<HTMLButtonElement>("button.primary")!;
      const screenBox = screen.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        screenBox: { left: screenBox.left, width: screenBox.width },
        inputHeight: input.getBoundingClientRect().height,
        buttonHeight: button.getBoundingClientRect().height,
        stylesheets: [...document.styleSheets]
          .map((sheet) => sheet.href)
          .filter((href): href is string => Boolean(href))
          .map((href) => new URL(href).pathname)
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.screenBox.left).toBeCloseTo((metrics.viewportWidth - metrics.screenBox.width) / 2, 0);
    expect(metrics.inputHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.stylesheets.some((path) => /^\/assets\/index-[^/]+\.css$/u.test(path))).toBe(true);
    expect(metrics.stylesheets.every((path) => /^\/assets\/(index|ProductHubHeader)-[^/]+\.css$/u.test(path))).toBe(true);
  }
});

test("student join explains an unreachable game server in classroom language", async ({ page }) => {
  await page.route("**/api/sessions/**/join", (route) => route.abort());
  await page.goto("/join?code=ABC123");
  await page.getByPlaceholder("Player name").fill("Network Test Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("this network cannot reach the game server");
});

test("Classic movement reaches the server after the student turns more than four times", async ({ page, request }, testInfo) => {
  const classroom = await createModeClassroom(request, { roundDurationSeconds: 120 });
  const headers = { Authorization: `Bearer ${classroom.teacherToken}` };
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Turning Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  expect((await request.post(`/api/sessions/${classroom.code}/start`, { headers })).ok()).toBe(true);
  await expect(page.getByText("Round live", { exact: true })).toBeVisible();
  await expect(page.locator(".game-menu-overlay")).toBeHidden();
  const canvas = page.locator(".arena-canvas canvas");
  await expect(canvas).toBeVisible();
  const getPlayer = async () => {
    const state = await request.get(`/api/sessions/${classroom.code}`, { headers });
    expect(state.ok()).toBe(true);
    const { session } = await state.json() as { session: { players: Array<{ x: number; z: number }> } };
    return session.players[0]!;
  };
  await page.keyboard.down("ArrowLeft");
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-player-facing"))), { timeout: 45_000 }).toBeGreaterThan(Math.PI * 8 + 0.3);
  await page.keyboard.up("ArrowLeft");
  const before = await getPlayer();
  await page.keyboard.down("w");
  await expect.poll(async () => {
    const after = await getPlayer();
    return Math.hypot(after.x - before.x, after.z - before.z);
  }).toBeGreaterThan(0.5);
  await page.keyboard.up("w");
  await page.screenshot({ path: testInfo.outputPath("classic-live.png") });
});

test("Zombie Survival shows the selection quiz and assigns both teams in the live arena", async ({ page, request }, testInfo) => {
  const classroom = await createModeClassroom(request, { gameMode: "zombie", roundDurationSeconds: 120 });
  const headers = { Authorization: `Bearer ${classroom.teacherToken}` };
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Survival Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  expect((await request.post(`/api/sessions/${classroom.code}/join`, { data: { nickname: "Classmate" } })).status()).toBe(201);
  expect((await request.post(`/api/sessions/${classroom.code}/start`, { headers })).ok()).toBe(true);
  await expect(page.getByText("Choosing Zombies", { exact: true })).toBeVisible();
  await expect(page.locator(".arena-frame")).toHaveAttribute("data-weapon-id", "none");
  await expect(page.getByLabel("Keyboard controls")).not.toContainText("Throw");
  await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
  await expect.poll(async () => {
    const state = await request.get(`/api/sessions/${classroom.code}`, { headers });
    const { session } = await state.json() as { session: { players: Array<{ nickname: string; correctAnswers: number }> } };
    return session.players.find((player) => player.nickname === "Survival Student")?.correctAnswers;
  }).toBe(1);
  await expect(page.getByText("Round live", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Humans 1 · Zombies 1", { exact: true })).toBeVisible();
  const canvas = page.locator(".arena-canvas canvas");
  await expect(canvas).toBeVisible();
  const active = await request.get(`/api/sessions/${classroom.code}`, { headers });
  const { session } = await active.json() as { session: { players: Array<{ nickname: string; x: number; z: number }> } };
  const own = session.players.find((player) => player.nickname === "Survival Student")!;
  const other = session.players.find((player) => player.nickname === "Classmate")!;
  expect(Math.hypot(own.x - other.x, own.z - other.z)).toBeGreaterThan(20);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-player-x")) - own.x)).toBeLessThan(1);
  await expect(page.getByRole("timer")).not.toContainText("2:00");
  await page.screenshot({ path: testInfo.outputPath("zombie-live.png") });
});

test("student lobby reports and recovers from a temporary realtime connection failure", async ({ page, request }) => {
  const classroom = await createClassroom(request);
  let blockRealtime = true;
  await page.route("**/socket.io/**", (route) => blockRealtime ? route.abort() : route.continue());
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Socket Test Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  const reconnecting = page.getByTestId("student-realtime-reconnecting");
  await expect(reconnecting).toContainText("Live game connection lost", { timeout: 15_000 });

  blockRealtime = false;
  await page.unroute("**/socket.io/**");

  await expect(reconnecting).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
});

test("school device check reports same-origin API and realtime paths", async ({ page }) => {
  const backendOrigins = new Set<string>();
  const directHostedBackendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname === "/socket.io" || url.pathname.startsWith("/socket.io/")) {
      backendOrigins.add(url.origin);
    }
    if (/api\.gyakuteneigo\.com|gyakuteneigo-api\.onrender\.com/i.test(url.hostname)) directHostedBackendRequests.push(url.href);
  });
  page.on("websocket", (webSocket) => {
    const url = new URL(webSocket.url());
    if (url.pathname === "/socket.io" || url.pathname.startsWith("/socket.io/")) backendOrigins.add(url.origin);
    if (/api\.gyakuteneigo\.com|gyakuteneigo-api\.onrender\.com/i.test(url.hostname)) directHostedBackendRequests.push(url.href);
  });
  await page.goto("/check");
  await expect(page.getByRole("heading", { name: "School device check" })).toBeVisible();
  await expect(page.getByTestId("diagnostic-website").locator(".diagnostic-status")).toHaveText("Connected");
  await expect(page.getByTestId("diagnostic-api").locator(".diagnostic-status")).toHaveText("Connected", { timeout: 15_000 });
  await expect(page.getByTestId("diagnostic-realtime").locator(".diagnostic-status")).toHaveText("Connected", { timeout: 15_000 });
  const normalizedBackendOrigins = [...backendOrigins].map((origin) => origin.replace(/^ws:/u, "http:").replace(/^wss:/u, "https:"));
  expect([...new Set(normalizedBackendOrigins)]).toEqual([new URL(page.url()).origin]);
  expect(directHostedBackendRequests).toEqual([]);
});

test("student customizes, reloads, and receives match start over Socket.IO", async ({ page, request }, testInfo) => {
  const classroom = await createClassroom(request);
  const browserStartedAt = performance.now();
  const initialScriptRequests: string[] = [];
  const socketFrameSizes: number[] = [];
  const socketFrames: string[] = [];
  const pageErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (browserRequest) => {
    if (browserRequest.resourceType() === "script") initialScriptRequests.push(browserRequest.url());
  });
  page.on("websocket", (webSocket) => {
    if (!webSocket.url().includes("socket.io")) return;
    webSocket.on("framereceived", ({ payload }) => {
      const text = typeof payload === "string" ? payload : payload.toString("utf8");
      socketFrameSizes.push(Buffer.byteLength(text));
      socketFrames.push(text);
    });
  });

  await page.goto(`/join?code=${classroom.code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  expect(initialScriptRequests.some((url) => /\/assets\/(?:App|StudentExperience|ArenaPreview|three)-/u.test(url))).toBe(false);
  await page.getByPlaceholder("Player name").fill("Browser Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();

  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  const creatorReadyMs = performance.now() - browserStartedAt;
  await expect(page.getByText("1 player joined", { exact: true })).toBeVisible();
  const foxHead = page.getByRole("button", { name: /Fox/ });
  const appearanceSaved = page.waitForResponse(
    (response) => response.request().method() === "PUT" && response.url().includes("/appearance")
  );
  await foxHead.click();
  expect((await appearanceSaved).status()).toBe(200);
  const appearanceSavedMs = performance.now() - browserStartedAt;
  await expect(foxHead).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await expect(page.getByRole("button", { name: /Fox/ })).toHaveAttribute("aria-pressed", "true");
  const restoredMs = performance.now() - browserStartedAt;

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByTestId("student-lobby-status")).toBeHidden();
  await expect.poll(() => socketFrames.some(
    (frame) => frame.includes("session_state") && (frame.includes('"status":"paused"') || frame.includes('"status":"active"'))
  )).toBe(true);
  const matchStartedMs = performance.now() - browserStartedAt;

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
  await expect(page.locator(".question-feedback-result")).toContainText("CORRECT");
  const feedbackScreenshotPath = testInfo.outputPath("answer-feedback-1920.png");
  await page.screenshot({ path: feedbackScreenshotPath });
  await testInfo.attach("answer-feedback-1920.png", {
    path: feedbackScreenshotPath,
    contentType: "image/png"
  });

  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Answer B: Not this one", exact: true }).click();
  const incorrectFeedback = page.locator(".question-feedback-result.is-incorrect");
  const incorrectSnapshot = await incorrectFeedback.evaluate((element) => ({
    text: element.textContent,
    bottom: element.getBoundingClientRect().bottom
  }));
  for (const text of ["INCORRECT", "Your answer", "Not this one", "Correct answer", "This one", "正解は A です。"]) {
    expect(incorrectSnapshot.text).toContain(text);
  }
  await expect(page.getByText("Browser Student answered incorrectly.", { exact: true })).toBeHidden();
  expect(incorrectSnapshot.bottom).toBeLessThanOrEqual(768);
  const incorrectScreenshotPath = testInfo.outputPath("incorrect-feedback-1366.png");
  await page.screenshot({ path: incorrectScreenshotPath });
  await testInfo.attach("incorrect-feedback-1366.png", {
    path: incorrectScreenshotPath,
    contentType: "image/png"
  });

  let releaseLearningReport!: () => void;
  const learningReportGate = new Promise<void>((resolve) => {
    releaseLearningReport = resolve;
  });
  await page.route("**/learning-report", async (route) => {
    await learningReportGate;
    await route.continue();
  });

  const finish = await request.post(`/api/sessions/${classroom.code}/end`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(finish.status()).toBe(200);
  await expect(page.getByText("Your learning report", { exact: true })).toBeVisible();
  await expect(page.locator(".student-learning-metrics")).toContainText("50%");
  const learningMetricBoxes = await page.locator(".student-learning-metrics > span").evaluateAll((metrics) => metrics.map((metric) => {
    const box = metric.getBoundingClientRect();
    return { top: Math.round(box.top), right: box.right };
  }));
  expect(new Set(learningMetricBoxes.map((box) => box.top)).size).toBe(1);
  expect(learningMetricBoxes.every((box) => box.right <= 1366)).toBe(true);
  await expect(page.getByText("Syncing your saved answers...", { exact: true })).toBeVisible();
  releaseLearningReport();
  await expect(page.getByText("Syncing your saved answers...", { exact: true })).toBeHidden();
  const worksheetButton = page.getByRole("button", { name: "Download Practice Worksheet", exact: true });
  await expect(worksheetButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await worksheetButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^QuizStrike-Practice-Browser Student-\d{4}-\d{2}-\d{2}\.pdf$/u);
  const worksheetPath = testInfo.outputPath("browser-practice-worksheet.pdf");
  await download.saveAs(worksheetPath);
  const worksheetBytes = await readFile(worksheetPath);
  expect(worksheetBytes.subarray(0, 8).toString("ascii")).toBe("%PDF-1.4");
  expect(worksheetBytes.byteLength).toBeGreaterThan(10_000);
  const worksheetStructure = worksheetBytes.subarray(0, 1024).toString("latin1");
  expect(worksheetStructure).toContain("/Count 1");
  expect(worksheetStructure).toContain("/MediaBox [0 0 595.28 841.89]");
  const japaneseCanvasRendering = await page.evaluate(async () => {
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (!context) return { width: 0, inkPixels: 0 };
    context.font = '19px "Noto Sans JP", "Noto Sans CJK JP", "Noto Sans CJK", "BIZ UDPGothic", "Yu Gothic", Meiryo, Arial, sans-serif';
    context.fillStyle = "#101820";
    context.fillText("鎌倉幕府を開いた人物は誰ですか。", 4, 32);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let inkPixels = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) inkPixels += 1;
    return { width: context.measureText("鎌倉幕府").width, inkPixels };
  });
  expect(japaneseCanvasRendering.width).toBeGreaterThan(0);
  expect(japaneseCanvasRendering.inkPixels).toBeGreaterThan(0);
  await testInfo.attach("browser-practice-worksheet.pdf", {
    path: worksheetPath,
    contentType: "application/pdf"
  });

  await expect(page.getByText("Your learning report", { exact: true })).toBeVisible();
  const viewportMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight
  }));
  expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
  const reportScreenshotPath = testInfo.outputPath("learning-report-1366.png");
  await page.screenshot({ path: reportScreenshotPath });
  await testInfo.attach("learning-report-1366.png", {
    path: reportScreenshotPath,
    contentType: "image/png"
  });

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
      reportViewport: viewportMetrics,
      pageErrors
    }, null, 2),
    contentType: "application/json"
  });
  await page.goto("about:blank");
});

test("teacher pause survives a student reconnect and live learning pulse updates", async ({ page, request, browser }) => {
  const classroom = await createClassroom(request);

  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Pause Test Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();

  const teacherContext = await browser.newContext();
  await teacherContext.addInitScript((token) => {
    window.localStorage.setItem("quizstrike_token", token);
  }, classroom.teacherToken);
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto("/quiz-strike");
  await teacherPage.getByRole("button", { name: "Teacher workspace", exact: true }).click();
  const liveSessionButton = teacherPage.getByRole("button", { name: new RegExp(`${classroom.code}\\s+1 players`, "u") });
  await expect(liveSessionButton).toBeVisible();
  await liveSessionButton.click();
  const pauseButton = teacherPage.getByRole("button", { name: "Pause Game", exact: true });
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(teacherPage.getByRole("button", { name: "Resume Game", exact: true })).toBeVisible();
  await expect(teacherPage.getByText("Game paused", { exact: true }).first()).toBeVisible();

  const pausedSnapshot = await request.get(`/api/sessions/${classroom.code}`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(pausedSnapshot.status()).toBe(200);
  expect((await pausedSnapshot.json()).session.controlState).toBe("teacher_paused");
  await expect(page.getByTestId("teacher-pause-overlay")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("teacher-pause-overlay")).toBeVisible();
  await expect(page.getByText("Look at the teacher.", { exact: true })).toBeVisible();

  await teacherPage.getByRole("button", { name: "Resume Game", exact: true }).click();
  await expect(teacherPage.getByRole("button", { name: "Pause Game", exact: true })).toBeVisible();
  await expect(page.getByTestId("teacher-pause-overlay")).toBeHidden();

  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
  await expect(page.locator(".question-feedback-result")).toContainText("CORRECT");
  const learningPulse = teacherPage.getByTestId("learning-pulse");
  await expect(learningPulse.locator(".learning-pulse-metrics > span").nth(0)).toContainText("100%");
  await expect(learningPulse.locator(".learning-pulse-metrics > span").nth(1)).toContainText("1");

  await expect.poll(async () => {
    const dashboard = await request.get("/api/teacher/dashboard", {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    expect(dashboard.status()).toBe(200);
    const payload = await dashboard.json() as { sessions: Array<{ sessionCode: string; learningPulse?: { answersSubmitted: number; classAccuracy: number | null } }> };
    const pulse = payload.sessions.find((session) => session.sessionCode === classroom.code)?.learningPulse;
    return pulse ? { answersSubmitted: pulse.answersSubmitted, classAccuracy: pulse.classAccuracy } : null;
  }).toEqual({ answersSubmitted: 1, classAccuracy: 100 });
  await teacherContext.close();
});

test("fresh joins replay remembered appearance without growing restore history", async ({ page, request }) => {
  const firstClassroom = await createClassroom(request, { persistAcrossSessions: true });
  await page.goto(`/join?code=${firstClassroom.code}`);
  await page.getByPlaceholder("Player name").fill("First Session Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();

  const firstAppearanceSaved = page.waitForResponse(
    (response) => response.request().method() === "PUT" && response.url().includes("/appearance")
  );
  await page.getByRole("button", { name: /Fox/ }).click();
  expect((await firstAppearanceSaved).status()).toBe(200);

  const secondClassroom = await createClassroom(request, { persistAcrossSessions: true });
  await page.goto(`/join?code=${secondClassroom.code}`);
  await page.getByPlaceholder("Player name").fill("Second Session Student");
  const rememberedAppearanceApplied = page.waitForResponse(
    (response) => response.request().method() === "PUT" && response.url().includes("/appearance")
  );
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  expect((await rememberedAppearanceApplied).status()).toBe(200);
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await expect(page.getByRole("button", { name: /Fox/ })).toHaveAttribute("aria-pressed", "true");

  const historyLengthBeforeRestore = await page.evaluate(() => window.history.length);
  await page.goto("/join");
  await expect(page).toHaveURL(/\/game$/u);
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  const historyLengthAfterRestore = await page.evaluate(() => window.history.length);
  expect(historyLengthAfterRestore).toBe(historyLengthBeforeRestore + 1);
});
