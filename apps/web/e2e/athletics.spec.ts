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
  await expect(page.locator(".athletics-hud")).toBeVisible({ timeout: 30_000 });
});
