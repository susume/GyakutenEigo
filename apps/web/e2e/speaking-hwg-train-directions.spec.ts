import { expect, test } from "@playwright/test";
import type { SpeakingActivity, SpeakingSession } from "@quizstrike/shared";

test("HWG assessment retains its train map from the library to the student context", async ({ page, request }, testInfo) => {
  const signup = await request.post("/api/auth/signup", {
    data: { name: "HWG Teacher", email: `hwg-directions-${Date.now()}@example.test`, password: "speaking-pass" }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto("/quiz-strike/teacher/speaking/core");
  await page.getByLabel("Search scenarios", { exact: true }).fill("HWG Giving Train Directions");
  await expect(page.locator(".speaking-core-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog");
  const mapUrl = "/assets/speaking/context-hwg-tokyo-train-map.png";
  await expect(preview).toContainText("Tokyo Station");
  await expect(preview).toContainText("Asakusa Station");
  const rubricGuide = preview.locator(".speaking-rubric-guide");
  await rubricGuide.locator("summary").click();
  await expect(rubricGuide.locator("h4")).toHaveCount(4);
  await expect(rubricGuide).toContainText("Full credit is possible with simple English and allowed support.");
  await expect(rubricGuide).toContainText("Zero means an observed unsuccessful attempt.");

  const savedResponse = page.waitForResponse((response) => response.url().endsWith("/api/speaking/activities") && response.request().method() === "POST");
  await preview.getByRole("button", { name: "Use as-is", exact: true }).click();
  const saved = await savedResponse;
  expect(saved.status()).toBe(201);
  const { activity } = await saved.json() as { activity: SpeakingActivity };
  expect(activity.title).toBe("HWG Giving Train Directions");
  expect(activity.mode).toBe("assessment");
  expect(activity.context?.imageUrl).toBe(mapUrl);
  expect(activity.scenarioResources?.context?.imageUrl).toBe(mapUrl);
  expect(activity.supportSettings?.showContext).toBe(true);
  expect(activity.scenarioResources?.exampleDialogue).toContain("You: Sure.");
  expect(activity.scenarioResources?.textbookReferences).toEqual(expect.arrayContaining([
    expect.objectContaining({ book: 2, pages: "77", pdfPages: [41] })
  ]));
  // The builder must preserve source metadata while allowing teachers to adapt
  // the dialogue; the launch snapshot must contain the saved version.
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}/edit`);
  await page.locator("summary").filter({ hasText: "Advanced settings" }).click();
  const dialogueEditor = page.getByRole("textbox", { name: "Example dialogue", exact: true });
  await expect(dialogueEditor).toHaveValue(activity.scenarioResources!.exampleDialogue!);
  const editedDialogue = `${activity.scenarioResources!.exampleDialogue!}\nPartner: Thank you for your help.`;
  await dialogueEditor.fill(editedDialogue);
  await page.getByRole("button", { name: "Save changes", exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/activity/${activity.id}$`));
  const updated = await (await request.get(`/api/speaking/activities/${activity.id}`, { headers })).json() as { activity: SpeakingActivity };
  expect(updated.activity.scenarioResources?.exampleDialogue).toBe(editedDialogue);
  expect(updated.activity.scenarioResources?.textbookReferences).toEqual(activity.scenarioResources?.textbookReferences);

  const launched = await request.post(`/api/speaking/activities/${activity.id}/sessions`, { headers, data: {} });
  expect(launched.status()).toBe(201);
  const { session } = await launched.json() as { session: SpeakingSession };
  const started = await request.post(`/api/speaking/sessions/${session.id}/start-session`, { headers, data: {} });
  expect(started.status()).toBe(200);
  const joined = await request.post("/api/speaking/join", { data: { code: session.joinCode, identifier: "HWG Student" } });
  expect(joined.status()).toBe(201);
  const { token: studentToken } = await joined.json() as { token: string };
  const studentStarted = await request.post(`/api/speaking/sessions/${session.id}/start`, { headers: { "X-Speaking-Token": studentToken }, data: {} });
  expect(studentStarted.status()).toBe(200);
  await page.addInitScript(({ id, value }) => {
    sessionStorage.setItem(`speaking-token:${id}`, value);
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel: () => undefined,
      getVoices: () => [],
      speak: (utterance: { onend?: () => void }) => setTimeout(() => utterance.onend?.(), 0)
    } });
  }, { id: session.id, value: studentToken });

  for (const viewport of [{ width: 1366, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`/speak/session/${session.id}`);
    await expect(page.locator(".speaking-student-screen-ready")).toBeVisible();
    await expect(page.locator(".speaking-partner-message p")).toHaveText("Excuse me. May I ask you something?");
    await page.getByRole("button", { name: "Open Context support", exact: true }).click();
    const context = page.getByRole("tabpanel", { name: "Context", exact: true });
    const map = context.locator("figure > img");
    await expect(map).toHaveAttribute("src", mapUrl);
    await expect.poll(() => map.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(600);
    await expect(map).toBeInViewport();
    await expect(map).toHaveCSS("object-fit", "contain");
    await expect(context.locator(".speaking-reference-sheet")).toHaveCount(0);
    await expect(context).not.toContainText("Your starting point and destination");
    if (viewport.width > 900) {
      expect((await map.boundingBox())!.height).toBeGreaterThan(500);
      expect((await map.boundingBox())!.width).toBeGreaterThan(450);
    }
    await context.getByRole("button", { name: "Enlarge image", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "Context image", exact: true });
    await expect(viewer).toBeVisible();
    const enlarged = viewer.locator("img");
    expect((await enlarged.boundingBox())!.width).toBeGreaterThanOrEqual(707);
    await viewer.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect.poll(async () => (await enlarged.boundingBox())!.width).toBeGreaterThanOrEqual(1060);
    await page.screenshot({ path: testInfo.outputPath(`hwg-map-enlarged-${viewport.width}.png`) });
    await page.keyboard.press("Escape");
    await expect(viewer).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`hwg-train-map-${viewport.width}.png`) });
    await page.getByRole("tab", { name: "Useful English", exact: true }).click();
    const english = page.getByRole("tabpanel", { name: "Useful English", exact: true });
    await expect(english).toContainText("Then, change to the … Line.");
    await expect(english).toContainText("Do you know how to buy a train ticket?");
    await expect(english).toContainText("Sure. I’ll show you. Follow me, please.");
    await expect(english).toContainText("どのくらい時間がかかりますか");
    await expect(english).toContainText("…はここからいくつめの駅ですか");
    await expect(english).toContainText("…まで行きたいです");
    await expect(english).toContainText("どの電車に乗ればよいか教えてもらえますか");
    await english.locator("summary").filter({ hasText: "Example dialogue" }).click();
    await expect(english.locator(".speaking-example-dialogue-lines")).toBeVisible();
    await expect(english.locator(".speaking-example-dialogue-lines")).toHaveText(editedDialogue);
    await english.locator("summary").filter({ hasText: "Textbook connections" }).click();
    await expect(english.locator(".speaking-textbook-references")).toContainText("NEW HORIZON 2");
    await expect(english.locator(".speaking-textbook-references")).toContainText("Real Life English 6");
    await expect(english.locator(".speaking-textbook-references")).toContainText("p. 77");
    await page.screenshot({ path: testInfo.outputPath(`hwg-textbook-support-${viewport.width}.png`) });
  }
});
