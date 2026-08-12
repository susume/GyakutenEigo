import { expect, test, type APIRequestContext } from "@playwright/test";

type TeacherFixture = { token: string; quizSetId: string };

const signupTeacher = async (request: APIRequestContext, name: string): Promise<{ token: string }> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const response = await request.post("/api/auth/signup", {
    data: { name, email: `teacher-ux-${suffix}@example.test`, password: "classroom-pass" }
  });
  expect(response.status()).toBe(201);
  return await response.json() as { token: string };
};

const createStudySet = async (request: APIRequestContext, token: string, title: string, visibility?: "PUBLIC"): Promise<TeacherFixture> => {
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post("/api/quiz-sets", { headers, data: { title, subject: "English", gradeLevel: "Eiken Pre-2" } });
  expect(created.status()).toBe(201);
  const { quizSet } = await created.json() as { quizSet: { id: string } };
  for (const [prompt, answer] of [["What does apple mean?", "りんご"], ["What does book mean?", "本"]] as const) {
    const question = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
      headers,
      data: { prompt, choiceA: answer, choiceB: "学校", choiceC: "先生", choiceD: "机", correctChoice: "A" }
    });
    expect(question.status()).toBe(201);
  }
  if (visibility === "PUBLIC") {
    const published = await request.patch(`/api/study-sets/${quizSet.id}`, { headers, data: { visibility } });
    expect(published.status()).toBe(200);
  }
  return { token, quizSetId: quizSet.id };
};

test("teacher creates continuously, opens a detail page, and hosts the same Study Set", async ({ page, request }) => {
  const teacher = await signupTeacher(request, "Study Set Creator");
  await page.addInitScript((token) => localStorage.setItem("quizstrike_token", token), teacher.token);
  await page.goto("/quiz-strike/teacher/home");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Study Set", exact: true })).toBeVisible();
  await page.getByLabel("Study Set title").fill("Eiken Pre-2 Starter");
  await page.getByText("Details and visibility", { exact: true }).click();
  await page.getByLabel("Subject", { exact: true }).fill("English");
  await page.getByLabel("Level", { exact: true }).fill("Eiken Pre-2");
  await page.getByRole("button", { name: "Import questions", exact: true }).click();

  await page.locator("textarea.bulk-textarea").fill("apple - りんご\nbook - 本");
  await page.getByRole("button", { name: "Add imported questions", exact: true }).click();
  await expect(page.locator("article.study-set-question-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Save Study Set", exact: true }).first().click();
  await expect(page.getByText("Saved privately to your Library.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  const card = page.locator("article.study-set-card").filter({ hasText: "Eiken Pre-2 Starter" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eiken Pre-2 Starter", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Host", exact: true }).click();
  await expect(page).toHaveURL(/\/quiz-strike\/teacher\/host\//u);
  await expect(page.getByRole("heading", { name: "Choose a game mode", exact: true })).toBeVisible();
  await expect(page.getByText("Selected from your content library", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Question set" })).toHaveCount(0);
});

test("a new teacher can Discover and host public content without copying it first", async ({ page, request }) => {
  const owner = await signupTeacher(request, "Community Set Creator");
  const title = `Public Eiken Set ${Date.now()}`;
  const publicSet = await createStudySet(request, owner.token, title, "PUBLIC");
  const visitor = await signupTeacher(request, "Discover Teacher");

  await page.addInitScript((token) => localStorage.setItem("quizstrike_token", token), visitor.token);
  await page.goto("/quiz-strike/teacher/discover");
  const card = page.locator("article.study-set-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(`Created by Community Set Creator`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Host", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/quiz-strike/teacher/host/${publicSet.quizSetId}$`, "u"));
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Question set" })).toHaveCount(0);
});
