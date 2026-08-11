import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type ClassroomFixture = {
  code: string;
  teacherToken: string;
};

type StudentFixture = {
  id: string;
  token: string;
  team: "red" | "blue";
  yaw: number;
  page: Page;
};

type Position = { x: number; y?: number; z: number; facing?: number };

const promoRoot = join(process.cwd(), "tools", "promo-v2");
const rawRoot = join(promoRoot, "raw");

const createPromoClassroom = async (request: APIRequestContext): Promise<ClassroomFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("http://127.0.0.1:4002/api/auth/signup", {
    data: {
      name: "QuizStrike V2 Trailer Teacher",
      email: `promo-v2-${suffix}@example.test`,
      password: "promo-v2-capture-pass"
    }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${token}` };

  const quiz = await request.post("http://127.0.0.1:4002/api/quiz-sets", {
    headers: authorization,
    data: { title: "QuizStrike V2 Trailer Questions" }
  });
  expect(quiz.status()).toBe(201);
  const { quizSet } = await quiz.json() as { quizSet: { id: string } };

  const questions = [
    ["Which word means the opposite of slow?", "Fast", "Quiet", "Small", "Late"],
    ["Choose the correct sentence.", "She runs every morning.", "She run every morning.", "She running every morning.", "She ran every morning tomorrow."],
    ["What is the past tense of go?", "Went", "Goed", "Going", "Goes"],
    ["Which word is a synonym for brave?", "Courageous", "Sleepy", "Narrow", "Silent"],
    ["Complete the phrase: break a ___.", "Leg", "Wall", "Window", "Clock"],
    ["Which word describes something very big?", "Huge", "Tiny", "Thin", "Short"],
    ["Which sentence uses a question mark correctly?", "Where are you going?", "Where are you going.", "Where are you going!", "Where are you going,"],
    ["Choose the correct plural.", "Children", "Childs", "Childes", "Childrens"]
  ];
  for (const [prompt, choiceA, choiceB, choiceC, choiceD] of questions) {
    const createdQuestion = await request.post(`http://127.0.0.1:4002/api/quiz-sets/${quizSet.id}/questions`, {
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

  const created = await request.post("http://127.0.0.1:4002/api/sessions", {
    headers: authorization,
    data: {
      quizSetId: quizSet.id,
      settings: {
        gameMode: "classic",
        mapId: "iron_junction",
        teamAssignment: "players_choose",
        maxPlayers: 10,
        roundCount: 1,
        roundDurationSeconds: 120,
        startingMoney: 0,
        startingSnowballs: 24,
        correctAnswerReward: 1500,
        fastAnswerBonus: 0,
        snowballPackPrice: 300,
        botDifficulty: "advanced",
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

const captureStyles = `
  .control-prompts { display: none !important; }
  .game-utility-bar { opacity: .9; }
  .game-menu-overlay .quiz-panel { transform: scale(1.18); transform-origin: center center; }
  .game-menu-overlay .buy-panel { transform: scale(1.12); transform-origin: center center; }
  .reward-toast { font-size: clamp(2rem, 4vw, 4rem) !important; text-shadow: 0 5px 22px rgba(2, 10, 20, .8); }
`;

const joinStudent = async (page: Page, code: string, nickname: string, team: "red" | "blue"): Promise<StudentFixture> => {
  await page.goto(`/join?code=${code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  const joinResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/sessions/${code}/join`) && response.request().method() === "POST"
  );
  await page.getByPlaceholder("Player name").fill(nickname);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  const joinResponse = await joinResponsePromise;
  expect(joinResponse.status()).toBe(201);
  const payload = await joinResponse.json() as { player: { id: string; facing?: number }; playerToken: string };
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`${team} team`, "i") }).click();
  await page.addStyleTag({ content: captureStyles });
  await page.waitForTimeout(350);
  return {
    id: payload.player.id,
    token: payload.playerToken,
    team,
    yaw: payload.player.facing ?? (team === "blue" ? -Math.PI / 2 : Math.PI / 2),
    page
  };
};

const readSession = async (request: APIRequestContext, code: string, token: string) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await request.get(`http://127.0.0.1:4002/api/sessions/${code}`, {
        headers: { "x-player-token": token }
      });
      expect(response.ok()).toBeTruthy();
      return (await response.json() as { session: { status: string; players: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> } }).session;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Could not read the live session.");
};

const getPosition = async (request: APIRequestContext, code: string, student: StudentFixture) => {
  const session = await readSession(request, code, student.token);
  const player = session.players.find((candidate) => candidate.id === student.id);
  if (!player || typeof player.x !== "number" || typeof player.z !== "number") throw new Error(`Could not read position for ${student.id}.`);
  return {
    x: player.x,
    z: player.z,
    y: typeof player.y === "number" ? player.y : undefined,
    facing: typeof player.facing === "number" ? player.facing : student.yaw,
    isAlive: player.isAlive !== false,
    health: typeof player.health === "number" ? player.health : undefined
  };
};

const normalizeAngle = (angle: number) => {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
};

const faceToward = async (student: StudentFixture, from: Position, target: Position) => {
  const desiredYaw = Math.atan2(-(target.x - from.x), -(target.z - from.z));
  const delta = normalizeAngle(desiredYaw - student.yaw);
  if (Math.abs(delta) > 0.03) {
    const key = delta > 0 ? "ArrowLeft" : "ArrowRight";
    await student.page.keyboard.down(key);
    await student.page.waitForTimeout(Math.max(30, Math.round(Math.abs(delta) / 1.9 * 1000)));
    await student.page.keyboard.up(key);
  }
  student.yaw = desiredYaw;
};

const moveToward = async (
  request: APIRequestContext,
  code: string,
  student: StudentFixture,
  target: Position,
  maxDurationMs = 13_000
) => {
  const start = await getPosition(request, code, student);
  // The arena can stream a server-authoritative facing update between route
  // segments. Always turn from the actual server heading, not our last local
  // estimate, so a long Playwright hold cannot accumulate yaw drift.
  if (typeof start.facing === "number") student.yaw = start.facing;
  await faceToward(student, start, target);
  const distance = Math.hypot(target.x - start.x, target.z - start.z);
  const durationMs = Math.min(maxDurationMs, Math.max(650, Math.round(distance / 11.5 * 1000)));
  await student.page.keyboard.down("w");
  await student.page.keyboard.down("Shift");
  await student.page.waitForTimeout(durationMs);
  await student.page.keyboard.up("Shift");
  await student.page.keyboard.up("w");
  const end = await getPosition(request, code, student);
  if (typeof end.facing === "number") student.yaw = end.facing;
  return end;
};

const moveAlongPath = async (
  request: APIRequestContext,
  code: string,
  student: StudentFixture,
  waypoints: Position[],
  onWaypoint?: (position: Position, waypoint: Position, index: number) => void
) => {
  let position = await getPosition(request, code, student);
  for (const [index, waypoint] of waypoints.entries()) {
    position = await moveToward(request, code, student, waypoint, 9_000);
    onWaypoint?.(position, waypoint, index);
  }
  return position;
};

const holdKeys = async (page: Page, keys: string[], durationMs: number) => {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
};

const getLocalCanvasPosition = async (student: StudentFixture) => student.page.locator(".arena-canvas canvas").evaluate((element) => ({
  x: Number(element.getAttribute("data-player-x") ?? NaN),
  z: Number(element.getAttribute("data-player-z") ?? NaN)
}));

test("capture substantially staged QuizStrike V2 trailer source footage", async ({ page, request, browser }) => {
  await mkdir(rawRoot, { recursive: true });
  const captureStartedAt = Date.now();
  const timeline: Record<string, unknown> = { capturedAt: new Date().toISOString(), viewport: { width: 1920, height: 1080 } };
  const video = page.video();
  const classroom = await createPromoClassroom(request);
  const helperContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
  const helperPage = await helperContext.newPage();
  let main: StudentFixture | undefined;
  let red: StudentFixture | undefined;

  const mark = (name: string, extra: Record<string, unknown> = {}) => {
    timeline[name] = { atMs: Date.now() - captureStartedAt, ...extra };
  };

  try {
    main = await joinStudent(page, classroom.code, "V2 Blue Anchor", "blue");
    mark("multiplayer_blue_character", { playerId: main.id });
    red = await joinStudent(helperPage, classroom.code, "V2 Red Rival", "red");
    mark("multiplayer_red_joined", { playerId: red.id });

    // Keep the two human clients alive for a clean, readable Red-vs-Blue
    // encounter. The real-time session itself is still multiplayer and the
    // combat shot remains server-authorized below.
    mark("bots_ready", { count: 0 });

    const started = await request.post(`http://127.0.0.1:4002/api/sessions/${classroom.code}/start`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    expect(started.status()).toBe(200);
    mark("preparation_started");

    await expect(page.getByText("Choose gear", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("q");
    await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
    mark("answer_question_visible");
    await page.getByRole("button", { name: /Answer A:/ }).click();
    await expect(page.locator(".question-feedback-result")).toContainText("CORRECT");
    await expect(page.locator(".question-feedback-reward")).toContainText("+$1500");
    mark("answer_correct_cash_awarded");
    await page.waitForTimeout(650);
    await page.keyboard.press("q");
    await page.keyboard.press("b");
    await expect(page.getByText("Balance $1500", { exact: true })).toBeVisible();
    mark("buy_panel_cash_visible");
    await page.keyboard.press("4");
    await expect(page.locator(".reward-toast")).toContainText("Warm Vest equipped", { timeout: 5_000 });
    mark("warm_vest_equipped");
    await page.keyboard.press("b");

    await expect(page.getByText("Round live", { exact: true })).toBeVisible({ timeout: 20_000 });
    mark("round_live", {
      blue: await getPosition(request, classroom.code, main),
      red: await getPosition(request, classroom.code, red)
    });
    const arena = page.locator(".arena-canvas");
    await arena.click({ position: { x: 960, y: 540 } });
    await helperPage.locator(".arena-canvas").click({ position: { x: 960, y: 540 } });

    // Use the open rail yard as a deliberate two-player lane. The strip at
    // z=10 stays between the locomotive, low cover, and overpass geometry, so
    // the server-authoritative positions and the visible client cameras agree.
    const mainRoute: Array<Record<string, unknown>> = [];
    const redRoute: Array<Record<string, unknown>> = [];
    const roundBlue = await getPosition(request, classroom.code, main);
    const roundRed = await getPosition(request, classroom.code, red);
    await Promise.all([
      moveAlongPath(request, classroom.code, main, [
        { x: -120, z: roundBlue.z },
        { x: -120, z: 10 },
        { x: 110, z: 10 }
      ], (position, waypoint, index) => mainRoute.push({ index, waypoint, position })),
      moveAlongPath(request, classroom.code, red, [
        { x: 120, z: roundRed.z },
        { x: 120, z: 10 },
        { x: 116, z: 10 }
      ], (position, waypoint, index) => redRoute.push({ index, waypoint, position }))
    ]);
    await Promise.all([
      moveAlongPath(request, classroom.code, main, [
        { x: 60, z: 10 },
        { x: 110, z: 10 }
      ]),
      moveToward(request, classroom.code, red, { x: 116, z: 10 }, 9_000)
    ]);
    mark("staged_encounter_lane", {
      mainRoute,
      redRoute,
      roundBlue,
      roundRed,
      mainLocal: await getLocalCanvasPosition(main),
      redLocal: await getLocalCanvasPosition(red)
    });

    // Tighten the two players to a readable, legal snowball range and let the
    // capture page own the shot. The server still validates line of sight,
    // range, cooldown, and target health; no fake hit is injected.
    let mainPosition = await getPosition(request, classroom.code, main);
    let redPosition = await getPosition(request, classroom.code, red);
    if (Math.hypot(mainPosition.x - redPosition.x, mainPosition.z - redPosition.z) > 24) {
      await moveToward(request, classroom.code, main, { x: redPosition.x - 10, z: redPosition.z }, 8_000);
      mainPosition = await getPosition(request, classroom.code, main);
      redPosition = await getPosition(request, classroom.code, red);
    }
    await main.page.bringToFront();
    await faceToward(main, mainPosition, redPosition);
    await page.waitForTimeout(180);
    mainPosition = await getPosition(request, classroom.code, main);
    redPosition = await getPosition(request, classroom.code, red);
    mark("opponent_in_sight", {
      main: mainPosition,
      red: redPosition,
      mainLocal: await getLocalCanvasPosition(main),
      redLocal: await getLocalCanvasPosition(red)
    });
    await page.waitForTimeout(250);
    for (let shot = 0; shot < 5; shot += 1) {
      await page.keyboard.press("f");
      await page.waitForTimeout(230);
    }
    mark("encounter_fire_burst");
    await expect(page.getByRole("status")).toContainText("Freeze! Opponent out.", { timeout: 6_000 });
    const postFireSession = await readSession(request, classroom.code, main.token);
    const redAfterFire = postFireSession.players.find((candidate) => candidate.id === red.id);
    expect(redAfterFire?.isAlive).toBe(false);
    mark("freeze_reward_score_event", {
      red: redAfterFire,
      blue: postFireSession.players.find((candidate) => candidate.id === main.id)
    });
    await page.waitForTimeout(650);

    // A brief result flash is a consequence of the hit, not the climax itself.
    await page.keyboard.down("Tab");
    await page.waitForTimeout(320);
    mark("scoreboard_result_flash");
    await page.keyboard.up("Tab");
    await page.waitForTimeout(700);

    // Keep the real encounter visible long enough to provide a strong hero
    // frame for the end card, while the soundtrack/edit supplies the payoff.
    mark("hero_source_hold");
    await page.waitForTimeout(2_200);
    timeline.finalSession = await readSession(request, classroom.code, main.token);
  } finally {
    await writeFile(join(rawRoot, "capture-timings.json"), JSON.stringify(timeline, null, 2), "utf8");
    await helperContext.close();
    await page.close();
    if (video) {
      const capturedPath = await video.path();
      await copyFile(capturedPath, join(rawRoot, "quizstrike-promo-v2-session.webm"));
    }
  }
});
