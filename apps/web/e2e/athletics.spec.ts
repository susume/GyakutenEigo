import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

test("Athletics sessions render Skyline Adventure Park instead of a combat map", async ({ page, request }, testInfo) => {
  const classroom = await createClassroom(request, { gameMode: "athletics" });

  await page.goto(`/join?code=${classroom.code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  await page.getByPlaceholder("Player name").fill("Athletics Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Choose your lane, then wait for the host to start." })).toBeVisible();
  await expect(page.locator(".athletics-briefing li")).toHaveCount(3);
  await expect(page.locator(".athletics-briefing")).toContainText("gold paths are optional shortcuts");
  await page.screenshot({ path: testInfo.outputPath("athletics-briefing.png") });
  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);

  await expect(page.locator(".arena-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".arena-canvas")).toHaveAttribute("aria-label", "Skyline Adventure Park athletics course");
  const canvas = page.locator(".arena-canvas canvas");
  await expect(canvas).toHaveAttribute("data-player-x", "0.000");
  await expect(canvas).toHaveAttribute("data-player-z", "123.000");
  await expect(canvas).toHaveAttribute("data-player-ground-y", "0.000");
  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".athletics-hud")).toHaveAttribute("data-testid", "athletics-compact-hud");
  await expect(page.locator(".athletics-hud")).toContainText("Movement energy");
  await expect(page.locator(".athletics-hud")).toContainText("Place");
  await expect(page.locator(".athletics-hud")).toContainText("Lap");
  await expect(page.locator(".athletics-hud")).toContainText("Time");
  await expect(page.locator(".athletics-hud")).not.toContainText(/Questions|Checkpoints|Skyline Adventure Park|Park Entrance|Jump forward|Answer Question/u);
  const hudBox = await page.locator(".athletics-hud").boundingBox();
  expect(hudBox).not.toBeNull();
  expect(hudBox?.width).toBeLessThanOrEqual(330);
  expect(hudBox?.height).toBeLessThanOrEqual(140);
  await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath("athletics-course.png") });
});

for (const athleticsMode of ["zeus", "hunters-runners", "chaos-climb"] as const) {
  test(`${athleticsMode} explains its rules and renders its live course`, async ({ page, request }, testInfo) => {
    const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode, roundDurationSeconds: 300 });
    await page.goto(`/join?code=${classroom.code}`);
    await page.getByPlaceholder("Player name").fill("Mode Explorer");
    await page.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(page.locator(".athletics-briefing li")).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath(`${athleticsMode}-briefing.png`) });
    const start = await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    expect(start.status()).toBe(200);
    await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`.athletics-mode-${athleticsMode}`)).toBeVisible();
    await expect(page.locator(".athletics-hud")).not.toContainText("GO in", { timeout: 15_000 });
    await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
    if (athleticsMode === "zeus" || athleticsMode === "chaos-climb") {
      // Observe actual attacks (and Chaos's fourth-wave event), not just the
      // quiet interval immediately after the start announcement.
      const observationMs = athleticsMode === "chaos-climb" ? 35_000 : 15_000;
      const deadline = Date.now() + observationMs;
      let warningsSeen = 0;
      while (Date.now() < deadline) {
        await expect(page.locator(".game-announcement")).toBeHidden();
        await expect(page.locator(".notification-layer")).toBeHidden();
        await expect(page.locator(".game-menu-overlay")).toBeHidden();
        warningsSeen += await page.locator(".athletics-threat-status").count();
        await page.waitForTimeout(200);
      }
      if (athleticsMode === "zeus") expect(warningsSeen).toBeGreaterThan(0);
      if (athleticsMode === "chaos-climb") {
        const snapshot = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
        expect(snapshot.status()).toBe(200);
        const { session } = await snapshot.json();
        expect(session.athletics.chaos.waveIndex).toBeGreaterThanOrEqual(4);
        await page.getByRole("button", { name: "Answer movement energy question", exact: true }).click();
        for (let correct = 0; correct < 3; correct += 1) {
          await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
        }
        await page.getByRole("button", { name: "Back to the game", exact: true }).click();
        await expect(page.locator(".athletics-variant-stats")).toContainText("3 / 3");
        await page.keyboard.press("r");
        await expect(page.locator(".athletics-variant-stats")).toContainText("0 / 3");
        const activated = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
        const activatedState = await activated.json();
        expect(activatedState.session.players[0].athletics.shieldCharges).toBe(1);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`${athleticsMode}-course.png`) });
  });
}

test.describe("Narrow touch warnings", () => {
test.use({ hasTouch: true });
test("Zeus warnings keep a narrow touch viewport and its controls clear", async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode: "zeus" });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Small Screen Runner");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".athletics-hud")).not.toContainText("GO in", { timeout: 15_000 });
  await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".athletics-threat-status")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".game-announcement")).toBeHidden();
  await expect(page.locator(".athletics-mode-banner")).toBeHidden();
  await expect(page.locator(".game-menu-overlay")).toBeHidden();
  const hud = await page.locator(".athletics-hud").boundingBox();
  expect(hud).not.toBeNull();
  expect(hud!.x).toBeGreaterThanOrEqual(0);
  expect(hud!.x + hud!.width).toBeLessThanOrEqual(375);
  expect(hud!.height).toBeLessThan(300);
  await expect(page.locator(".athletics-onboarding")).toBeHidden();
  const utility = await page.locator(".game-utility-bar").boundingBox();
  expect(hud!.y).toBeGreaterThan(utility!.y + utility!.height);
  const jump = await page.locator(".athletics-touch-controls .touch-jump").boundingBox();
  const answer = await page.locator(".athletics-touch-controls .touch-question").boundingBox();
  expect(answer!.y - (jump!.y + jump!.height)).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: testInfo.outputPath("zeus-narrow-warning.png") });
  await page.setViewportSize({ width: 812, height: 375 });
  const canvas = page.locator(".arena-canvas canvas");
  await expect.poll(() => canvas.evaluate((element) => Math.abs(element.clientWidth - element.parentElement!.clientWidth))).toBeLessThanOrEqual(2);
  await expect.poll(() => canvas.evaluate((element) => {
    const drawingCanvas = element as HTMLCanvasElement;
    return Math.abs(drawingCanvas.width / drawingCanvas.height
      - drawingCanvas.parentElement!.clientWidth / drawingCanvas.parentElement!.clientHeight);
  })).toBeLessThan(.03);
  // Orientation and adaptive graphics can rebuild the renderer on the next
  // frame. Verify the settled layout rather than measuring the old HUD.
  await expect.poll(async () => {
    const landscapeHud = await page.locator(".athletics-hud").boundingBox();
    const joystick = await page.locator(".athletics-touch-controls .touch-joystick").boundingBox();
    return landscapeHud && joystick ? joystick.y - (landscapeHud.y + landscapeHud.height) : -Infinity;
  }).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: testInfo.outputPath("zeus-landscape-warning.png") });
  await page.locator(".touch-question").press("Enter");
  await expect(page.locator(".game-menu-overlay")).toBeVisible();
  const answers = page.locator(".answer-grid button");
  for (const button of await answers.all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(375);
  }
  await page.screenshot({ path: testInfo.outputPath("landscape-question.png") });
});

test("Chaos charged ability keeps landscape controls and the course clear", async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 812, height: 375 });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode: "chaos-climb", roundDurationSeconds: 300 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Landscape Ability Runner");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".athletics-hud")).not.toContainText("GO in", { timeout: 15_000 });
  await page.locator(".touch-question").tap();
  for (let correct = 0; correct < 3; correct += 1) await page.getByRole("button", { name: "Answer A: This one", exact: true }).tap();
  await page.getByRole("button", { name: "Back to the game", exact: true }).tap();
  const ability = page.getByRole("button", { name: "Use SHIELD", exact: true });
  await expect(ability).toBeVisible();
  await expect.poll(async () => {
    const hud = await page.locator(".athletics-hud").boundingBox();
    const joystick = await page.locator(".athletics-touch-controls .touch-joystick").boundingBox();
    return hud && joystick ? joystick.y - hud.y - hud.height : -Infinity;
  }).toBeGreaterThanOrEqual(8);
  for (const button of await page.locator(".athletics-touch-controls button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(375);
  }
  await page.screenshot({ path: testInfo.outputPath("chaos-landscape-charged.png") });
  await ability.tap();
  await expect(page.locator(".athletics-variant-stats")).toContainText("0 / 3");
});
});

test("a racer can move, jump, refuel and recover after a fall", async ({ page, request }, testInfo) => {
  const classroom = await createClassroom(request, { gameMode: "athletics", roundDurationSeconds: 300 });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Playthrough Runner");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".athletics-hud")).not.toContainText("GO in", { timeout: 15_000 });
  await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
  const canvas = page.locator(".arena-canvas canvas");
  await page.keyboard.down("w");
  await expect.poll(async () => Number(await canvas.getAttribute("data-player-x"))).toBeLessThan(-5);
  await page.keyboard.press("Space");
  await expect.poll(async () => Number(await canvas.getAttribute("data-player-y"))).toBeGreaterThan(5);
  await page.keyboard.up("w");
  await expect.poll(async () => Number(await canvas.getAttribute("data-player-y"))).toBeLessThan(4.3);
  const energyBefore = await page.locator(".athletics-energy-meter").getAttribute("aria-valuenow");
  await page.getByRole("button", { name: "Answer movement energy question", exact: true }).click();
  await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
  await expect.poll(async () => Number(await page.locator(".athletics-energy-meter").getAttribute("aria-valuenow"))).toBeGreaterThan(Number(energyBefore));
  await page.getByRole("button", { name: "Back to the game", exact: true }).click();
  await page.keyboard.down("d");
  await expect(page.getByRole("progressbar", { name: "Recovery question progress" })).toBeVisible();
  await page.keyboard.up("d");
  await expect(page.locator(".athletics-recovery-banner")).toBeHidden();
  await page.setViewportSize({ width: 812, height: 375 });
  for (const button of await page.locator(".answer-grid button").all()) {
    const box = await button.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(375);
  }
  await page.screenshot({ path: testInfo.outputPath("compact-fall-recovery.png") });
  for (let correct = 1; correct <= 3; correct += 1) {
    await page.getByRole("button", { name: "Answer A: This one", exact: true }).click();
    if (correct < 3) await expect(page.getByRole("progressbar", { name: "Recovery question progress" })).toHaveAttribute("aria-valuenow", String(correct));
  }
  await expect(page.locator(".game-menu-overlay")).toBeHidden({ timeout: 15_000 });
  const returnedX = Number(await canvas.getAttribute("data-player-x"));
  await page.keyboard.down("w");
  await expect.poll(async () => Number(await canvas.getAttribute("data-player-x"))).toBeLessThan(returnedX - 1);
  await page.keyboard.up("w");
});
