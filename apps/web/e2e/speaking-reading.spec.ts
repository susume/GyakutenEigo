import { expect, test } from "@playwright/test";

const sampleWav = process.env.SPEAKING_E2E_WAV;
test.skip(!sampleWav || process.env.SPEAKING_READ_ALOUD_ENABLED !== "true", "Enable Read Aloud on the disposable API and provide an original synthetic WAV.");

test("teacher imports and assigns a passage, student uploads local audio, and teacher confirms", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(250_000);
  page.setDefaultTimeout(15_000);
  const signup = await request.post("/api/auth/signup", { data: { name: "Synthetic Reading Teacher", email: `reading-${Date.now()}@example.test`, password: "synthetic-reading-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json();
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("/api/speaking/activities", { headers, data: {
    title: "Original reading assessment", scenario: "Read the assigned passage.", aiRole: "Classmate", studentRole: "Student",
    level: "beginner", difficulty: "easy", nativeLanguage: "en", durationSeconds: 180, identifierMode: "nickname",
    mode: "assessment", targetExpressions: [],
    rubric: [{ id: "communication", name: "Communication", description: "Give a clear answer.", enabled: true }]
  } });
  expect(created.status()).toBe(201);
  const { activity } = await created.json();
  await page.addInitScript((value) => {
    localStorage.setItem("quizstrike_token", value);
    localStorage.setItem("gyakuteneigo.language", "en");
  }, token);
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}`);
  if (process.env.SPEAKING_STRUCTURED_ENABLED === "true" && process.env.SPEAKING_ADAPTIVE_ENABLED === "true") {
    const mode = page.getByRole("checkbox", { name: "Structured conversation (experimental)" });
    if (!await mode.isChecked()) await mode.check();
    await page.getByRole("button", { name: "Use weekend template" }).click();
    await page.getByText("Simulate conversation", { exact: true }).click();
    await page.getByLabel("Sample student response").fill("I stayed home.");
    await page.getByRole("button", { name: "Try response" }).click();
    await expect(page.getByText("What did you do at home?", { exact: true })).toBeVisible();
  }
  await page.getByRole("checkbox", { name: "Read Aloud / 音読チェック" }).check();
  await page.getByLabel("Paste JSON").fill(JSON.stringify({ formatVersion: 1, passages: [
    { grade: 1, textbook: "Original Reading", edition: "Pilot", unit: "1", part: "A", text: "I like reading books. My favorite subject is English." },
    { grade: 2, textbook: "Original Reading", edition: "Pilot", unit: "3", part: "B", text: "We made a new map." }
  ] }));
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("checkbox", { name: "I have permission" }).check();
  await page.getByRole("button", { name: "Import validated passages" }).click();
  await expect(page.getByText("Passages saved.")).toBeVisible();
  const picker = page.locator(".speaking-reading-selectors");
  await picker.getByLabel("Grade").selectOption("2");
  await picker.getByLabel("Textbook").selectOption({ label: "Original Reading · Pilot" });
  await picker.getByLabel("Unit").selectOption("3");
  await picker.getByLabel("Grade").selectOption("1");
  await expect(picker.getByLabel("Unit")).toBeDisabled();
  await expect(picker.getByLabel("Part")).toBeDisabled();
  await picker.getByLabel("Textbook").selectOption({ label: "Original Reading · Pilot" });
  await picker.getByLabel("Unit").selectOption("1");
  await picker.getByLabel("Part").selectOption({ label: "A" });
  await page.screenshot({ path: testInfo.outputPath("teacher-assignment.png"), fullPage: true });
  const launch = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/activities/${activity.id}/sessions`));
  await page.getByRole("button", { name: "Launch session", exact: true }).click();
  const launched = await launch;
  expect(launched.status()).toBe(201);
  const { session } = await launched.json();

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: "http://127.0.0.1:4173" });
  try {
    await studentContext.addInitScript(() => localStorage.setItem("gyakuteneigo.language", "en"));
    const student = await studentContext.newPage();
    await student.goto("/speak/read-aloud");
    await expect(student.getByRole("heading", { name: "Read Aloud" })).toBeVisible();
    await student.goto(`/speak/join/${session.joinCode}`);
    await student.getByLabel("Nickname or student number", { exact: false }).fill("Synthetic learner");
    await student.getByRole("button", { name: "Join speaking task" }).click();
    await expect(student.getByText("I like reading books. My favorite subject is English.")).toBeVisible();
    await student.getByLabel("Choose a recording").setInputFiles(sampleWav!);
    await expect(student.getByLabel("Preview recording")).toBeVisible();
    expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await student.screenshot({ path: testInfo.outputPath("student-upload-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Start session", exact: true }).click();
    const submit = student.getByRole("button", { name: "Transcribe and submit" });
    await expect(submit).toBeVisible();
    const turn = student.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/turn"), { timeout: 180_000 });
    await submit.click();
    const turnResponse = await turn;
    expect(turnResponse.ok()).toBe(true);
    expect(turnResponse.request().headers()["content-type"]).toBe("application/vnd.speakcheck.transcript+json");
    expect(Buffer.byteLength(turnResponse.request().postData() ?? "")).toBeLessThan(1_000);
    const { studentTurn } = await turnResponse.json();
    await expect(student.getByRole("heading", { name: "Waiting for teacher review" })).toBeVisible();
    await student.setViewportSize({ width: 768, height: 1024 });
    expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
    await student.screenshot({ path: testInfo.outputPath("student-results-tablet.png"), fullPage: true });
    await page.goto(`/quiz-strike/teacher/speaking/result/${studentTurn.participantId}`);
    await expect(page.getByRole("heading", { name: "Waiting for teacher review" })).toBeVisible();
    await page.getByRole("combobox", { name: "Reading accuracy", exact: true }).selectOption("3");
    await page.getByLabel("Comment").fill("Clear and steady when I listened in class.");
    await page.getByRole("button", { name: "Confirm assessment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Teacher assessment confirmed" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("teacher-review-desktop.png"), fullPage: true });
    await student.getByRole("button", { name: "Refresh review status" }).click();
    await expect(student.getByRole("heading", { name: "Teacher assessment confirmed" })).toBeVisible();
  } finally { await studentContext.close().catch(() => {}); }
});
