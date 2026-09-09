import { expect, test } from "@playwright/test";

test("Set launch persists history and deleted Sets remain filterable in Reports", async ({ page, request }, testInfo) => {
  const signup = await request.post("/api/auth/signup", { data: { name: "Set audit", email: `set-${Date.now()}@example.test`, password: "speaking-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };
  const templates = await (await request.get("/api/speaking/templates")).json();
  const created = await request.post("/api/speaking/activities", { headers, data: templates.items[0] });
  expect(created.status()).toBe(201);
  const { activity } = await created.json();
  const setResponse = await request.post("/api/speaking/sets", { headers, data: { name: "September Class A" } });
  expect(setResponse.status()).toBe(201);
  const { set } = await setResponse.json();
  expect((await request.post(`/api/speaking/sets/${set.id}/activities/${activity.id}`, { headers })).ok()).toBeTruthy();
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto(`/quiz-strike/teacher/speaking/set/${set.id}`);
  await expect(page.getByRole("heading", { name: set.name })).toBeVisible();
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`set-launch-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: `Launch ${activity.title} from Set`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Start session", exact: true })).toBeVisible();
  const sessionId = new URL(page.url()).searchParams.get("sessionId");
  expect(sessionId).toBeTruthy();
  let reports = await (await request.get("/api/speaking/reports", { headers })).json();
  expect(reports.items).toHaveLength(0);
  expect((await request.post(`/api/speaking/sessions/${sessionId}/end`, { headers })).ok()).toBeTruthy();
  reports = await (await request.get("/api/speaking/reports", { headers })).json();
  expect(reports.items[0].session.speakingSetId).toBe(set.id);
  expect((await request.delete(`/api/speaking/sets/${set.id}`, { headers })).ok()).toBeTruthy();
  await page.goto("/quiz-strike/teacher/speaking/reports");
  await expect(page.getByRole("heading", { name: "Speaking reports" })).toBeVisible();
  await page.getByLabel("Filter speaking reports by Set").selectOption(set.id);
  await expect(page.locator(".speaking-report-row")).toContainText(set.name);
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`historical-reports-${width}.png`), fullPage: true });
  }
});
