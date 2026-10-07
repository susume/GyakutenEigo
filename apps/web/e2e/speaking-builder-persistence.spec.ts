import { expect, test } from "@playwright/test";
import type { SpeakingActivity } from "@quizstrike/shared";

test("builder spaces persist through create, reopen, edit and save", async ({ page, request }, testInfo) => {
  const signup = await request.post("/api/auth/signup", { data: { name: "Builder audit", email: `builder-${Date.now()}@example.test`, password: "speaking-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto("/quiz-strike/teacher/speaking/create");
  await page.getByRole("button", { name: /Start from scratch/ }).click();
  const values = {
    "Activity name": "Giving Train Directions for Grade 2",
    "Speaking situation": "The student should give directions using the metro map.",
    "AI role": "Confused Tourist",
    "Student role": "Station helper",
    "Opening line": "Hello there, can you help?",
    "Student goal": "Explain the route clearly.",
    "AI context": "The visitor needs to reach Osaka.",
    "Possible complication": "The visitor misunderstands the platform."
  };
  for (const [label, value] of Object.entries(values)) {
    const input = page.getByRole("textbox", { name: label, exact: true });
    await input.fill("");
    await input.pressSequentially(value);
    await expect(input).toHaveValue(value);
    await expect(input).toBeFocused();
  }
  const conditions = page.getByLabel("Success conditions", { exact: false });
  await conditions.fill("");
  await conditions.pressSequentially("Explain the route");
  await conditions.press("Enter");
  await conditions.pressSequentially("Confirm understanding");
  await expect(conditions).toHaveValue("Explain the route\nConfirm understanding");
  await page.getByRole("button", { name: "Create Performance Test", exact: true }).last().click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  const detail = page.url();
  await page.goto(`${detail}/edit`);
  await expect(page.getByRole("heading", { name: "Edit Performance Test" })).toBeVisible();
  await expect(conditions).toHaveValue("Explain the route\nConfirm understanding");
  for (const [label, value] of Object.entries(values)) await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
  const title = page.getByRole("textbox", { name: "Activity name", exact: true });
  await title.press("End");
  await title.pressSequentially(" Class A");
  await page.getByRole("button", { name: "Save changes", exact: true }).last().click();
  await expect(page).toHaveURL(detail);
  await page.goto(`${detail}/edit`);
  await expect(title).toHaveValue(`${values["Activity name"]} Class A`);
  for (const [label, value] of Object.entries(values).filter(([label]) => label !== "Activity name")) await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
  await page.screenshot({ path: testInfo.outputPath("builder-persisted-spaces.png"), fullPage: true });
});

test("editing an existing task preserves its optional scene environment and context", async ({ page, request }) => {
  const signup = await request.post("/api/auth/signup", { data: { name: "Scene audit", email: `scene-${Date.now()}@example.test`, password: "speaking-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };
  const { items } = await (await request.get("/api/speaking/templates")).json() as { items: SpeakingActivity[] };
  const sceneBackground = "/assets/speaking/practice-plaza.webp";
  const template = items.find((item) => item.id === "core-helping-a-tourist")!;
  const created = await request.post("/api/speaking/activities", { headers, data: {
    ...template, scenarioResources: { ...template.scenarioResources, sceneBackground }
  } });
  expect(created.status()).toBe(201);
  const { activity } = await created.json() as { activity: SpeakingActivity };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto(`/quiz-strike/teacher/speaking/activity/${activity.id}/edit`);
  await page.getByRole("textbox", { name: "Task name", exact: true }).fill("Tourist scene preserved after editing");
  await page.getByRole("button", { name: "Save changes", exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/activity/${activity.id}$`));
  const saved = await (await request.get(`/api/speaking/activities/${activity.id}`, { headers })).json() as { activity: SpeakingActivity };
  expect(saved.activity.title).toBe("Tourist scene preserved after editing");
  expect(saved.activity.scenarioResources?.sceneBackground).toBe(sceneBackground);
  expect(saved.activity.context?.imageUrl).toBe(template.context?.imageUrl);
});
