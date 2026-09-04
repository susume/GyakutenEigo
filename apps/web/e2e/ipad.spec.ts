import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

test("iPad-like profile joins, starts, renders the arena shell, and accepts touch controls", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "flag", roundCount: 3, startingMoney: 4000 });

  await page.goto(`/join?code=${classroom.code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  await page.getByPlaceholder("Player name").fill("iPad Student");
  await page.getByRole("button", { name: "Join game", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  const redTeam = page.getByRole("button", { name: /Red team/i });
  await redTeam.tap();
  await expect(redTeam).toHaveAttribute("aria-pressed", "true");
  const bot = await request.post(`/api/sessions/${classroom.code}/bots`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` },
    data: { count: 1 }
  });
  expect(bot.status()).toBe(201);

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);

  await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".arena-canvas")).toBeVisible({ timeout: 30_000 });
  const canvas = page.locator(".arena-webgl");
  await expect(canvas).toHaveCount(1);
  await page.evaluate(() => {
    const currentCanvas = document.querySelector(".arena-webgl");
    if (!(currentCanvas instanceof HTMLCanvasElement)) throw new Error("Arena canvas was not created.");
    (window as typeof window & { __quizstrikeArenaCanvas?: HTMLCanvasElement }).__quizstrikeArenaCanvas = currentCanvas;
  });
  const originalRendererId = await canvas.getAttribute("data-renderer-instance-id");
  await expect(canvas).toHaveAttribute("data-renderer-create-count", "1");
  await expect(canvas).toHaveAttribute("data-renderer-dispose-count", "0");
  const expectStableCanvas = async () => {
    await expect(canvas).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const remembered = (window as typeof window & { __quizstrikeArenaCanvas?: HTMLCanvasElement }).__quizstrikeArenaCanvas;
      return document.querySelector(".arena-webgl") === remembered;
    })).toBe(true);
    await expect(canvas).toHaveAttribute("data-renderer-instance-id", originalRendererId ?? "");
    await expect(canvas).toHaveAttribute("data-renderer-dispose-count", "0");
  };
  const joystick = page.getByRole("button", { name: "Movement joystick" });
  await expect(joystick).toBeVisible();
  const crouch = page.getByRole("button", { name: "Crouch", exact: true });
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  await expect(crouch).toBeVisible();
  await expect(jump).toBeVisible();
  await crouch.tap();
  await expect(crouch).toHaveAttribute("aria-pressed", "true");
  await crouch.tap();
  await jump.tap();
  await joystick.tap();
  const interact = page.getByRole("button", { name: "Interact with environment" });
  await expect(interact).toBeVisible();

  type FlagSessionSnapshot = {
    session: {
      flag?: { state?: string; position?: { x: number; z: number } };
      players: Array<{
        nickname: string;
        team: string;
        isBot?: boolean;
        x?: number;
        z?: number;
        facing?: number;
      }>;
    };
  };
  const readFlagSession = async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    expect(response.ok()).toBe(true);
    return await response.json() as FlagSessionSnapshot;
  };
  const initialFlagSession = await readFlagSession();
  const studentPosition = initialFlagSession.session.players.find((player) => player.nickname === "iPad Student");
  const flagPosition = initialFlagSession.session.flag?.position;
  if (!studentPosition || !Number.isFinite(studentPosition.x) || !Number.isFinite(studentPosition.z) || !flagPosition) {
    throw new Error("Could not resolve the Flag student's or flag's live position.");
  }
  const joystickBox = await joystick.boundingBox();
  if (!joystickBox) throw new Error("Movement joystick has no layout box.");
  const joystickRadius = Math.max(1, Math.min(joystickBox.width, joystickBox.height) * 0.34);
  const joystickCenter = {
    x: joystickBox.x + joystickBox.width / 2,
    y: joystickBox.y + joystickBox.height / 2
  };
  const joystickPointerId = 9041;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  await joystick.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    clientX: joystickCenter.x,
    clientY: joystickCenter.y,
    pointerId: joystickPointerId,
    pointerType: "touch"
  });
  let reachedFlag = false;
  const facing = studentPosition.facing ?? 0;
  for (let step = 0; step < 30; step += 1) {
    const localPosition = await page.evaluate(() => {
      const currentCanvas = document.querySelector(".arena-webgl");
      return currentCanvas instanceof HTMLCanvasElement
        ? { x: Number(currentCanvas.dataset.playerX), z: Number(currentCanvas.dataset.playerZ) }
        : null;
    });
    if (!localPosition || !Number.isFinite(localPosition.x) || !Number.isFinite(localPosition.z)) {
      throw new Error("Could not resolve the Flag student's local canvas position.");
    }
    const deltaX = flagPosition.x - localPosition.x;
    const deltaZ = flagPosition.z - localPosition.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= 5.5) {
      reachedFlag = true;
      break;
    }
    const forwardX = -Math.sin(facing);
    const forwardZ = -Math.cos(facing);
    const rightX = Math.cos(facing);
    const rightZ = -Math.sin(facing);
    const forward = clamp((deltaX * forwardX + deltaZ * forwardZ) / distance);
    const right = clamp((deltaX * rightX + deltaZ * rightZ) / distance);
    const stickX = right * joystickRadius;
    const stickY = -forward * joystickRadius;
    await page.evaluate(({ clientX, clientY, pointerId }) => {
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 1,
        clientX,
        clientY,
        pointerId,
        pointerType: "touch"
      }));
    }, {
      clientX: joystickCenter.x + stickX,
      clientY: joystickCenter.y + stickY,
      pointerId: joystickPointerId
    });
    await page.waitForTimeout(100);
  }
  await page.evaluate((pointerId) => {
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      buttons: 0,
      pointerId,
      pointerType: "touch"
    }));
  }, joystickPointerId);
  await expect.poll(async () => {
    const snapshot = await readFlagSession();
    const student = snapshot.session.players.find((player) => player.nickname === "iPad Student");
    const liveFlagPosition = snapshot.session.flag?.position;
    if (!student || !liveFlagPosition || !Number.isFinite(student.x) || !Number.isFinite(student.z)) return Number.POSITIVE_INFINITY;
    return Math.hypot(liveFlagPosition.x - student.x!, liveFlagPosition.z - student.z!);
  }, { timeout: 5_000, intervals: [200, 400, 800] }).toBeLessThan(7);
  expect(reachedFlag).toBe(true);
  await interact.tap();
  await expect.poll(async () => {
    return (await readFlagSession()).session.flag?.state ?? "missing";
  }, { timeout: 10_000 }).toBe("carried");
  await page.getByRole("button", { name: "Questions", exact: true }).tap();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  const firstAnswer = page.locator(".answer-grid button").first();
  await expect(firstAnswer).toBeEnabled();
  await firstAnswer.click();
  const answerFeedbackResult = page.locator(".question-feedback-result");
  try {
    await expect(answerFeedbackResult).toBeVisible();
  } catch {
    // A transient Socket.IO ack failure leaves the answer button enabled again;
    // retry only after the UI confirms that the first attempt did not commit.
    await expect(firstAnswer).toBeEnabled({ timeout: 5_000 });
    await firstAnswer.click();
    await expect(answerFeedbackResult).toBeVisible();
  }
  await expectStableCanvas();

  await page.context().setOffline(true);
  const endRound = await request.post(`/api/sessions/${classroom.code}/end-round`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(endRound.status()).toBe(200);

  await expect.poll(async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    const body = await response.json() as { session: { currentRound: number; status: string } };
    return `${body.session.currentRound}:${body.session.status}`;
  }, { timeout: 15_000 }).toBe("2:active");

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));

  await expect(page.locator(".mode-pill")).toContainText("Round 2/", { timeout: 15_000 });
  await expectStableCanvas();
  const endRoundTwo = await request.post(`/api/sessions/${classroom.code}/end-round`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(endRoundTwo.status()).toBe(200);

  await expect(page.getByRole("heading", { name: /Get ready/ })).toBeVisible({ timeout: 15_000 });
  const quickLauncher = page.getByRole("button", { name: /Quick Snowball Launcher/ });
  await expect(quickLauncher).toBeEnabled();
  await quickLauncher.click();
  await expect(page.locator(".arena-frame")).toHaveAttribute("data-weapon-id", "quick_blaster");
  await expectStableCanvas();

  await expect.poll(async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    const body = await response.json() as { session: { currentRound: number } };
    return body.session.currentRound;
  }, { timeout: 15_000 }).toBe(3);

  await expect(page.locator(".mode-pill")).toContainText("Round 3/", { timeout: 15_000 });
  await expectStableCanvas();
  await page.getByRole("button", { name: "Questions", exact: true }).tap();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await expect(page.locator(".answer-grid button").first()).toBeEnabled();
});

test("iPad-like Athletics controls expose crouch and jump together", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics" });

  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("iPad Athletics Student");
  await page.getByRole("button", { name: "Join game", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Choose your lane, then wait for the host to start." })).toBeVisible();

  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);

  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 30_000 });
  const joystick = page.getByRole("button", { name: "Movement joystick" });
  const crouch = page.getByRole("button", { name: "Crouch", exact: true });
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  await expect(joystick).toBeVisible();
  await expect(crouch).toBeVisible();
  await expect(jump).toBeVisible();
  await expect(jump).toBeEnabled({ timeout: 10_000 });
  await crouch.tap();
  await expect(crouch).toHaveAttribute("aria-pressed", "true");
  await joystick.tap();
  await jump.tap();
});
