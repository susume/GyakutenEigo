import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

test("iPad-like profile joins, starts, renders the arena shell, and accepts touch controls", async ({ page, request }) => {
  const classroom = await createClassroom(request);

  await page.goto(`/join?code=${classroom.code}`);
  await expect(page.getByPlaceholder("Player name")).toBeVisible();
  await page.getByPlaceholder("Player name").fill("iPad Student");
  await page.getByRole("button", { name: "Join game", exact: true }).tap();

  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  const start = await request.post(`/api/sessions/${classroom.code}/start`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(start.status()).toBe(200);

  await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".arena-canvas")).toBeVisible({ timeout: 30_000 });
  const joystick = page.getByRole("button", { name: "Movement joystick" });
  await expect(joystick).toBeVisible();
  await joystick.tap();
  await page.getByRole("button", { name: "Questions", exact: true }).tap();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
});
