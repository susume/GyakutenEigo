import { expect, test } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

test("iPad-like profile joins, starts, renders the arena shell, and accepts touch controls", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "flag" });

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
  const interact = page.getByRole("button", { name: "Interact with environment" });
  await expect(interact).toBeVisible();
  await interact.tap();
  await page.getByRole("button", { name: "Questions", exact: true }).tap();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await page.locator(".answer-grid button").first().tap();
  await expect(page.locator(".question-feedback-result")).toBeVisible();

  await page.context().setOffline(true);
  const endRound = await request.post(`/api/sessions/${classroom.code}/end-round`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` }
  });
  expect(endRound.status()).toBe(200);

  await expect.poll(async () => {
    const response = await request.get(`/api/sessions/${classroom.code}`, {
      headers: { Authorization: `Bearer ${classroom.teacherToken}` }
    });
    const body = await response.json() as { session: { currentRound: number } };
    return body.session.currentRound;
  }, { timeout: 15_000 }).toBe(2);

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));

  await expect(page.locator(".mode-pill")).toContainText("Round 2/", { timeout: 15_000 });
  await page.getByRole("button", { name: "Questions", exact: true }).tap();
  await expect(page.getByText("Choose an answer", { exact: true })).toBeVisible();
  await expect(page.locator(".answer-grid button").first()).toBeEnabled();
});

test("iPad-like Athletics controls expose sprint and jump together", async ({ page, request }) => {
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
  const sprint = page.getByRole("button", { name: "Sprint", exact: true });
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  await expect(joystick).toBeVisible();
  await expect(sprint).toBeVisible();
  await expect(jump).toBeVisible();
  await expect(jump).toBeEnabled({ timeout: 10_000 });
  await sprint.tap();
  await expect(sprint).toHaveAttribute("aria-pressed", "true");
  await joystick.tap();
  await jump.tap();
});
