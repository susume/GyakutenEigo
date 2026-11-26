import { expect, test } from "@playwright/test";

const sampleWav = process.env.SPEAKING_E2E_WAV;
test.skip(!sampleWav, "Set SPEAKING_E2E_WAV to a synthetic WAV of the preparation sentence.");
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${sampleWav}%noloop`]
  }
});

test("teacher and student complete the on-device speech pilot in the browser", async ({ context, page, request }, testInfo) => {
  test.setTimeout(250_000);
  const signup = await request.post("/api/auth/signup", { data: { name: "Local speech QA", email: `local-speech-${Date.now()}@example.test`, password: "local-speech-qa" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json();
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("/api/speaking/activities", { headers, data: {
    title: "Book conversation", scenario: "Talk about books you like.", aiRole: "Classmate", studentRole: "Student",
    level: "beginner", difficulty: "easy", nativeLanguage: "en", durationSeconds: 180, identifierMode: "nickname",
    mode: "practice", targetExpressions: [],
    rubric: [{ id: "communication", name: "Communication", description: "Give a clear answer.", enabled: true }]
  } });
  expect(created.status()).toBe(201);
  const { activity } = await created.json();
  await page.addInitScript((value) => {
    localStorage.setItem("quizstrike_token", value);
    localStorage.setItem("gyakuteneigo.language", "en");
  }, token);
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}`);
  await page.getByRole("checkbox", { name: "Use on-device speech recognition (pilot)" }).check();
  const launch = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/activities/${activity.id}/sessions`));
  await page.getByRole("button", { name: "Launch session", exact: true }).click();
  const { session } = await (await launch).json();
  expect(session.localTranscription).toBe(true);

  const student = await context.newPage();
  await student.setViewportSize({ width: 390, height: 844 });
  await student.goto(`/speak/join/${session.joinCode}`);
  await student.getByLabel("Nickname or student number", { exact: false }).fill("QA student");
  await student.getByRole("button", { name: "Join speaking task" }).click();
  await expect(student.getByRole("heading", { name: "On-device speech check" })).toBeVisible();
  await expect(student).toHaveURL(/\/speak\/prepare\//u);
  await student.reload();
  await expect(student.getByRole("heading", { name: "On-device speech check" })).toBeVisible();
  expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await student.screenshot({ path: testInfo.outputPath("on-device-preparation-mobile.png"), fullPage: true });
  await student.getByRole("button", { name: "Prepare speech model" }).click();
  await expect(student.getByText(/^Model loaded/u)).toBeVisible({ timeout: 180_000 });
  await student.getByRole("button", { name: "Record a sample" }).click();
  await expect(student.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await student.waitForTimeout(4_000);
  await student.getByRole("button", { name: "Stop recording" }).click();
  await student.locator("audio").evaluate((audio) => {
    if (!(audio instanceof HTMLAudioElement)) throw new Error("Expected the sample audio player.");
    return audio.play();
  });
  await student.getByRole("button", { name: "I heard it. Check recognition" }).click();
  await expect(student.getByRole("button", { name: "Continue to activity" })).toBeEnabled({ timeout: 45_000 });
  await expect(page.locator(".speaking-roster-row")).toContainText("Device ready", { timeout: 15_000 });

  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await student.getByRole("button", { name: "Continue to activity" }).click();
  await expect(student).toHaveURL(/\/speak\/session\//u);
  await student.getByRole("button", { name: "Tap to speak", exact: true }).click({ timeout: 45_000 });
  await expect(student.getByRole("button", { name: "Stop speaking", exact: true })).toBeVisible();
  await student.waitForTimeout(4_000);
  const turn = student.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/turn"), { timeout: 75_000 });
  await student.getByRole("button", { name: "Stop speaking", exact: true }).click();
  const response = await turn;
  expect(response.request().headers()["content-type"]).toBe("application/vnd.speakcheck.transcript+json");
  expect(response.ok()).toBe(true);
  expect((await response.json()).studentTurn.clientTranscribed).toBe(true);
  await student.getByRole("button", { name: "Finish practice", exact: true }).click({ timeout: 45_000 });
  await expect(student.getByText("Provisional feedback from device-generated transcripts. Ask your teacher to confirm the assessment.")).toBeVisible({ timeout: 45_000 });
});
