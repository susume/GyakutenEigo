import { expect, test } from "@playwright/test";

test("classroom overview supports forty students and session controls", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const signup = await request.post("/api/auth/signup", { data: { name: "Classroom QA Teacher", email: `classroom-${Date.now()}@example.test`, password: "speaking-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/quiz-strike/teacher/speaking");
  await expect(page.getByRole("heading", { name: "Speaking Practice", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("teacher-empty.png"), fullPage: true });
  const created = await request.post("/api/speaking/activities", { headers, data: {
    title: "Unit 3 · Weekend plans", scenario: "Make plans for Saturday with a classmate.", aiRole: "Classmate", studentRole: "Student",
    level: "elementary", difficulty: "normal", nativeLanguage: "ja", durationSeconds: 180, identifierMode: "nickname",
    targetExpressions: ["Would you like to…?", "How about Saturday?", "That sounds fun."],
    rubric: [{ id: "communication", name: "Communication", description: "Suggest a plan clearly.", enabled: true }, { id: "interaction", name: "Interaction", description: "Ask and respond to a question.", enabled: true }]
  } });
  expect(created.status()).toBe(201);
  const { activity } = await created.json();
  const launched = await request.post(`/api/speaking/activities/${activity.id}/sessions`, { headers, data: {} });
  expect(launched.status()).toBe(201);
  const { session } = await launched.json();
  const participants: Array<{ token: string; participant: { id: string } }> = [];
  for (let index = 1; index <= 40; index++) {
    const joined = await request.post("/api/speaking/join", { data: { code: session.joinCode, identifier: `Student ${String(index).padStart(2, "0")}` } });
    expect(joined.status()).toBe(201);
    const participant = await joined.json();
    participants.push(participant);
    if (index <= 30) {
      const ready = await request.post(`/api/speaking/sessions/${session.id}/start`, { headers: { "X-Speaking-Token": participant.token }, data: {} });
      expect(ready.status()).toBe(409);
    }
  }
  await page.reload();
  await expect(page.getByRole("button", { name: `Open ${activity.title}`, exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("teacher-dashboard.png"), fullPage: true });
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}`);
  await expect(page.locator(".speaking-roster-row")).toHaveCount(40);
  await page.screenshot({ path: testInfo.outputPath("teacher-roster-40.png"), fullPage: true });
  await page.getByRole("button", { name: "Project join screen", exact: true }).click();
  const projector = page.getByRole("dialog");
  await expect(projector).toBeVisible();
  await expect(projector).toContainText(session.joinCode);
  await expect(projector).not.toContainText("Student 01");
  await expect(projector).not.toContainText("Classroom QA Teacher");
  await page.screenshot({ path: testInfo.outputPath("teacher-projector.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await expect(projector).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Project join screen", exact: true })).toBeFocused();
  await page.getByLabel("Filter classroom roster", { exact: true }).selectOption("ready");
  await expect(page.locator(".speaking-roster-row")).toHaveCount(30);
  await page.getByLabel("Search classroom roster", { exact: true }).fill("Student 01");
  await expect(page.locator(".speaking-roster-row")).toHaveCount(1);
  await page.getByLabel("Search classroom roster", { exact: true }).fill("");
  await page.getByLabel("Filter classroom roster", { exact: true }).selectOption("all");
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await expect(page.locator(".speaking-roster-heading")).toContainText("active");
  await page.getByRole("button", { name: "Pause session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume session", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume session", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("teacher-live-monitor.png"), fullPage: false });
  const pauseBounds = await page.getByRole("button", { name: "Pause session", exact: true }).boundingBox();
  expect(pauseBounds!.y).toBeGreaterThanOrEqual(0);
  expect(pauseBounds!.y + pauseBounds!.height).toBeLessThanOrEqual(768);
  await page.evaluate(() => { document.documentElement.style.zoom = "1.25"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  await page.screenshot({ path: testInfo.outputPath("teacher-monitor-zoom-125.png"), fullPage: false });
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    {
      const rows = page.locator(".speaking-roster-row");
      const timestamp = await rows.first().locator("time").boundingBox();
      const nextName = await rows.nth(1).locator("strong").boundingBox();
      expect(timestamp!.y + timestamp!.height).toBeLessThanOrEqual(nextName!.y);
    }
    await page.screenshot({ path: testInfo.outputPath(`teacher-monitor-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  // Real mock-provider submissions, including one deliberately unscored attempt.
  for (const [index, participant] of participants.slice(0, 5).entries()) {
    const studentHeaders = { "X-Speaking-Token": participant.token };
    expect((await request.post(`/api/speaking/sessions/${session.id}/start`, { headers: studentHeaders, data: {} })).status()).toBe(200);
    if (index < 4) expect((await request.post(`/api/speaking/sessions/${session.id}/turn`, { headers: { ...studentHeaders, "Content-Type": "audio/webm", "X-Speaking-Audio-Activity": "true" }, data: Buffer.from("mock browser audio") })).status()).toBe(200);
    expect((await request.post(`/api/speaking/sessions/${session.id}/finish`, { headers: studentHeaders, data: {} })).ok()).toBeTruthy();
  }
  await page.getByRole("button", { name: "View results", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Communication", exact: true })).toBeVisible();
  await expect(page.locator(".speaking-class-summary")).toContainText("5 / 40", { timeout: 20_000 });
  await page.getByLabel("Filter learning results", { exact: true }).selectOption("review");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Not scored");
  await page.screenshot({ path: testInfo.outputPath("class-results-needs-review.png"), fullPage: true });
  await page.getByLabel("Filter learning results", { exact: true }).selectOption("all");
  await page.getByLabel("Sort class results", { exact: true }).selectOption("name");
  await expect(page.locator("tbody tr").first()).toContainText("Student 01");
  await page.screenshot({ path: testInfo.outputPath("class-results-40.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const sessionSelect = await page.locator(".speaking-results-heading > select").boundingBox();
  expect(sessionSelect!.height).toBeLessThanOrEqual(60);
  await page.screenshot({ path: testInfo.outputPath("class-results-mobile.png"), fullPage: false });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}`);
  await expect(page.locator(".speaking-roster-row")).toHaveCount(40);
  // Controlled visual fixture for transient states; this is not device telemetry.
  const rosterSnapshot = await (await request.get(`/api/speaking/sessions/${session.id}/roster`, { headers })).json();
  const statuses = ["joined", "ready", "practicing", "processing", "evaluating", "finished", "error"];
  rosterSnapshot.items.forEach((item: { status: string }, index: number) => { item.status = statuses[index % statuses.length]; });
  rosterSnapshot.counts = Object.fromEntries(statuses.map((status) => [status, rosterSnapshot.items.filter((item: { status: string }) => item.status === status).length]));
  await page.route(`**/api/speaking/sessions/${session.id}/roster`, (route) => route.fulfill({ json: rosterSnapshot }));
  await expect(page.locator(".speaking-roster-row").first()).toContainText("Needs attention");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("teacher-mixed-statuses-fixture.png"), fullPage: true });
  await page.unroute(`**/api/speaking/sessions/${session.id}/roster`);
  // Polling failure must not silently label a retained snapshot as current.
  await page.route(`**/api/speaking/sessions/${session.id}/roster`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Roster connection interrupted." }) }));
  await expect(page.getByRole("alert")).toContainText("last received roster", { timeout: 10_000 });
  await expect(page.locator(".speaking-roster-row")).toHaveCount(40);
  await page.screenshot({ path: testInfo.outputPath("teacher-roster-stale.png"), fullPage: true });
  await page.unroute(`**/api/speaking/sessions/${session.id}/roster`);
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 10_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Launch session", exact: true })).toBeVisible();
  await page.goto("/quiz-strike/teacher/speaking");
  await expect(page.getByRole("heading", { name: "Recent completed sessions", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("teacher-completed-dashboard.png"), fullPage: true });
  await page.getByRole("button", { name: `Open ${activity.title}`, exact: true }).click();
  await page.locator(".speaking-setup-details > summary").click();
  await page.getByRole("button", { name: "Edit activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Performance Test", exact: true })).toBeVisible();
  await page.getByLabel("Activity name", { exact: true }).fill("Unit 3 · Plans with a friend");
  await page.getByLabel("Communication description", { exact: true }).fill("Suggest a clear plan and give one reason.");
  await page.getByRole("button", { name: "Save changes", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Unit 3 · Plans with a friend", exact: true })).toBeVisible();
  const saved = await request.get(`/api/speaking/activities/${activity.id}`, { headers });
  expect((await saved.json()).activity.rubric[0].description).toBe("Suggest a clear plan and give one reason.");
  const previous = await request.get(`/api/speaking/sessions/${session.id}/results`, { headers });
  expect((await previous.json()).activity.title).toBe("Unit 3 · Weekend plans");
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}?sessionId=${session.id}`);
  await page.getByRole("button", { name: "Launch session", exact: true }).click();
  await expect(page.locator(".speaking-join-code-block strong")).not.toHaveText(session.joinCode);
  await expect(page.getByRole("button", { name: "Start session", exact: true })).toBeVisible();
  await expect(page.locator(".speaking-roster-row")).toHaveCount(0);
});
