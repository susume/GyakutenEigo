import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

test("Athletics sessions render Skyline Adventure Park instead of a combat map", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics" });

  await page.goto(`/join?code=${classroom.code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  await page.getByPlaceholder("Player name").fill("Athletics Student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Choose your lane, then wait for the host to start." })).toBeVisible();
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
});
