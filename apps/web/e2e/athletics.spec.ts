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
    const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode });
    await page.goto(`/join?code=${classroom.code}`);
    await page.getByPlaceholder("Player name").fill("Mode Explorer");
    await page.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(page.locator(".athletics-briefing li")).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath(`${athleticsMode}-briefing.png`) });
    const start = await request.post(`/api/sessions/${classroom.code}/start`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    expect(start.status()).toBe(200);
    await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`.athletics-mode-${athleticsMode}`)).toBeVisible();
    await expect(page.locator(".game-announcement")).toBeHidden({ timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath(`${athleticsMode}-course.png`) });
  });
}
