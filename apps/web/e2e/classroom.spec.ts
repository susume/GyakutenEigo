import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
        formBackground: getComputedStyle(form).backgroundColor,
        inputBackground: getComputedStyle(input).backgroundColor,
        inputMinHeight: getComputedStyle(input).minHeight,
        buttonBackground: getComputedStyle(button).backgroundColor,
        buttonBorderRadius: getComputedStyle(button).borderRadius,
        stylesheets: [...document.styleSheets]
          .map((sheet) => sheet.href)
          .filter((href): href is string => Boolean(href))
          .map((href) => new URL(href).pathname)
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.screenBox.left).toBeCloseTo((metrics.viewportWidth - metrics.screenBox.width) / 2, 0);
    expect(metrics.formBackground).toBe("rgba(10, 23, 49, 0.92)");
    expect(metrics.inputBackground).toBe("rgba(4, 13, 31, 0.88)");
    expect(metrics.inputMinHeight).toBe("58px");
    expect(metrics.buttonBackground).toBe("rgb(20, 130, 90)");
    expect(metrics.buttonBorderRadius).toBe("5px");
    expect(metrics.stylesheets).toHaveLength(1);
    expect(metrics.stylesheets[0]).toMatch(/^\/assets\/index-[^/]+\.css$/u);
  }
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

  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fox/ })).toHaveAttribute("aria-pressed", "true");
  const restoredMs = performance.now() - browserStartedAt;

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeHidden();
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
  await expect(incorrectFeedback).toContainText("INCORRECT");
  await expect(incorrectFeedback).toContainText("Your answer");
  await expect(incorrectFeedback).toContainText("Not this one");
  await expect(incorrectFeedback).toContainText("Correct answer");
  await expect(incorrectFeedback).toContainText("This one");
  await expect(incorrectFeedback).toContainText("正解は A です。");
  await expect(page.getByText("Browser Student answered incorrectly.", { exact: true })).toBeHidden();
  const incorrectFeedbackBox = await incorrectFeedback.boundingBox();
  expect(incorrectFeedbackBox).not.toBeNull();
  expect(incorrectFeedbackBox!.y + incorrectFeedbackBox!.height).toBeLessThanOrEqual(768);
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

test("fresh joins replay remembered appearance without growing restore history", async ({ page, request }) => {
  const firstClassroom = await createClassroom(request, { persistAcrossSessions: true });
  await page.goto(`/join?code=${firstClassroom.code}`);
  await page.getByPlaceholder("Player name").fill("First Session Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fox/ })).toHaveAttribute("aria-pressed", "true");

  const historyLengthBeforeRestore = await page.evaluate(() => window.history.length);
  await page.goto("/join");
  await expect(page).toHaveURL(/\/game$/u);
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  const historyLengthAfterRestore = await page.evaluate(() => window.history.length);
  expect(historyLengthAfterRestore).toBe(historyLengthBeforeRestore + 1);
});
