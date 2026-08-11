import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type ClassroomFixture = {
  code: string;
  teacherToken: string;
};

const promoRoot = join(process.cwd(), "tools", "promo");
const rawRoot = join(promoRoot, "raw");

const createPromoClassroom = async (request: APIRequestContext): Promise<ClassroomFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: {
      name: "QuizStrike Promo Teacher",
      email: `promo-${suffix}@example.test`,
      password: "promo-capture-pass"
    }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${token}` };

  const quiz = await request.post("/api/quiz-sets", {
    headers: authorization,
    data: { title: "QuizStrike Classroom Demo" }
  });
  expect(quiz.status()).toBe(201);
  const { quizSet } = await quiz.json() as { quizSet: { id: string } };

  const questions = [
    ["Which word means the opposite of slow?", "Fast", "Quiet", "Small", "Late"],
    ["Choose the correct sentence.", "She runs every morning.", "She run every morning.", "She running every morning.", "She ran every morning tomorrow."],
    ["What is the past tense of go?", "Went", "Goed", "Going", "Goes"],
    ["Which word is a synonym for brave?", "Courageous", "Sleepy", "Narrow", "Silent"],
    ["Complete the phrase: break a ___.", "Leg", "Wall", "Window", "Clock"],
    ["Which word describes something very big?", "Huge", "Tiny", "Thin", "Short"]
  ];
  for (const [prompt, choiceA, choiceB, choiceC, choiceD] of questions) {
    const createdQuestion = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
      headers: authorization,
      data: {
        prompt,
        choiceA,
        choiceB,
        choiceC,
        choiceD,
        correctChoice: "A",
        explanation: "The first choice is correct."
      }
    });
    expect(createdQuestion.status()).toBe(201);
  }

  const created = await request.post("/api/sessions", {
    headers: authorization,
    data: {
      quizSetId: quizSet.id,
      settings: {
        gameMode: "classic",
        mapId: "desert_citadel",
        teamAssignment: "players_choose",
        maxPlayers: 8,
        roundCount: 3,
        roundDurationSeconds: 120,
        startingMoney: 0,
        startingSnowballs: 10,
        correctAnswerReward: 400,
        characterCustomization: {
          enabled: true,
          uploadsEnabled: false,
          aiEnabled: false,
          persistAcrossSessions: false
        }
      }
    }
  });
  expect(created.status()).toBe(201);
  const { session } = await created.json() as { session: { sessionCode: string } };
  return { code: session.sessionCode, teacherToken: token };
};

const holdKeys = async (page: Page, keys: string[], durationMs: number) => {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
};

test("capture real QuizStrike promo source footage", async ({ page, request }) => {
  await mkdir(rawRoot, { recursive: true });
  const captureStartedAt = Date.now();
  const stageTimes: Record<string, number> = {};
  const video = page.video();
  const classroom = await createPromoClassroom(request);

  try {
    await page.goto(`/join?code=${classroom.code}`);
    await expect(page.getByPlaceholder("Player name")).toBeVisible();
    stageTimes.join_screen = Date.now() - captureStartedAt;
    await page.getByPlaceholder("Player name").fill("Promo Player");
    await page.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Red team/i })).toBeVisible();
    await page.getByRole("button", { name: /Red team/i }).click();
    stageTimes.lobby_team = Date.now() - captureStartedAt;
    await page.waitForTimeout(2_500);

    const bots = await request.post(`/api/sessions/${classroom.code}/bots`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` },
      data: { count: 7, difficulty: "advanced" }
    });
    expect(bots.status()).toBe(201);

    const started = await request.post(`/api/sessions/${classroom.code}/start`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    expect(started.status()).toBe(200);
    stageTimes.preparation = Date.now() - captureStartedAt;
    await expect(page.getByRole("button", { name: "Questions", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Questions", exact: true }).click();
    await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
    stageTimes.question = Date.now() - captureStartedAt;
    await page.getByRole("button", { name: /Answer A:/ }).click();
    await expect(page.locator(".question-feedback-result")).toContainText("CORRECT");
    stageTimes.correct_feedback = Date.now() - captureStartedAt;
    await page.waitForTimeout(2_000);
    const returnButton = page.getByRole("button", { name: "Back to the game", exact: true });
    if (await returnButton.isVisible()) await returnButton.click();

    await expect(page.getByText("Round live", { exact: true })).toBeVisible({ timeout: 35_000 });
    stageTimes.round_active = Date.now() - captureStartedAt;
    const arena = page.locator(".arena-canvas");
    await expect(arena).toBeVisible();
    await arena.click({ position: { x: 960, y: 540 } });
    await holdKeys(page, ["w", "Shift"], 2_200);
    stageTimes.sprint = Date.now() - captureStartedAt;
    await page.keyboard.press("f");
    await page.waitForTimeout(750);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("f");
    await page.waitForTimeout(900);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("f");
    stageTimes.combat = Date.now() - captureStartedAt;
    await holdKeys(page, ["a"], 1_500);
    await page.keyboard.press("f");
    await page.waitForTimeout(1_500);

    await page.keyboard.down("Tab");
    await page.waitForTimeout(1_800);
    stageTimes.scoreboard = Date.now() - captureStartedAt;
    await page.keyboard.up("Tab");
    await page.waitForTimeout(2_500);
    stageTimes.hero = Date.now() - captureStartedAt;
    await page.waitForTimeout(1_500);
  } finally {
    await writeFile(join(rawRoot, "capture-timings.json"), JSON.stringify({
      capturedAt: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      stages: stageTimes
    }, null, 2), "utf8");
    await page.close();
    if (video) {
      const capturedPath = await video.path();
      await copyFile(capturedPath, join(rawRoot, "quizstrike-promo-session.webm"));
    }
  }
});
