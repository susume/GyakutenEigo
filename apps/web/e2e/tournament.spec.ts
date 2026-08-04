import { expect, test, type APIRequestContext } from "@playwright/test";

type TournamentFixture = {
  token: string;
  quizSetId: string;
};

const createTournamentFixture = async (request: APIRequestContext): Promise<TournamentFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: {
      name: "Tournament Browser Teacher",
      email: `tournament-browser-${suffix}@example.test`,
      password: "classroom-pass"
    }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${token}` };

  const quiz = await request.post("/api/quiz-sets", {
    headers: authorization,
    data: { title: `Tournament Quiz ${suffix}` }
  });
  expect(quiz.status()).toBe(201);
  const { quizSet } = await quiz.json() as { quizSet: { id: string } };

  const question = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
    headers: authorization,
    data: {
      prompt: "Which answer is correct?",
      choiceA: "This one",
      choiceB: "Not this one",
      choiceC: "Still no",
      choiceD: "Nope",
      correctChoice: "A"
    }
  });
  expect(question.status()).toBe(201);
  return { token, quizSetId: quizSet.id };
};

test("teacher creates and publishes a tournament study-first bracket", async ({ page, request }) => {
  const fixture = await createTournamentFixture(request);
  const title = `Browser Tournament ${Date.now()}`;

  await page.addInitScript((token) => localStorage.setItem("quizstrike_token", token), fixture.token);
  await page.goto("/quiz-strike");
  await expect(page.getByRole("button", { name: "Teacher Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Teacher Dashboard" }).click();
  await expect(page.getByRole("button", { name: "Tournaments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tournaments", exact: true }).click();
  await expect(page.getByText("Your tournament calendar is empty")).toBeVisible();

  await page.getByRole("button", { name: "Create tournament" }).click();
  await page.getByLabel("Tournament name").fill(title);
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByLabel("Quiz set")).toBeVisible();
  await expect(page.getByLabel("Quiz set")).not.toHaveValue("");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Approved study items")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Teams can be added after publishing.")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Ready for review")).toBeVisible();

  const createdResponse = page.waitForResponse((response) => response.url().includes("/api/tournaments") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Create draft tournament/ }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { tournament } = await created.json() as { tournament: { id: string } };

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: /Publish tournament/ }).click();
  await expect(page.getByText("Registration open")).toBeVisible();

  const invitationResponse = await request.post(`/api/tournaments/${tournament.id}/invitations`, { headers: { Authorization: `Bearer ${fixture.token}` } });
  expect(invitationResponse.status()).toBe(201);
  const invitation = await invitationResponse.json() as { link: string };
  await page.goto(invitation.link);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByLabel("Team name").fill("Invited Scholars");
  await page.getByLabel("School name").fill("East School");
  await page.getByLabel(/Roster display names/).fill("Yui, Hana");
  await page.getByRole("button", { name: "Submit team registration" }).click();
  await expect(page.getByText("Registration received")).toBeVisible();
  await page.goto("/quiz-strike");
  await expect(page.getByRole("button", { name: "Teacher Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Teacher Dashboard" }).click();
  await page.getByRole("button", { name: "Tournaments", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("button", { name: "Study pack", exact: true }).click();
  await page.getByRole("button", { name: "Release now" }).click();
  await expect(page.getByText("Study pack released.")).toBeVisible();

  await page.getByRole("button", { name: "Teams", exact: true }).click();
  await page.getByPlaceholder("Team name").fill("Blue Scholars");
  await page.getByPlaceholder("School name").fill("North School");
  await page.getByPlaceholder(/Roster display names/).fill("Aki, Ren");
  await page.getByRole("button", { name: "Add team" }).click();
  await expect(page.getByText("Blue Scholars")).toBeVisible();

  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: /Generate bracket/ }).click();
  await expect(page.getByText("Bracket is ready")).toBeVisible();
  await page.getByRole("button", { name: "Bracket", exact: true }).click();
  await expect(page.getByText("Single elimination")).toBeVisible();
  await expect(page.getByRole("button", { name: "Invited Scholars - Blue Scholars" })).toBeVisible();

  await page.goto(`/tournament-study/${tournament.id}`);
  await expect(page.getByText("Official study pack")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("adapt", { exact: true })).toBeVisible();
  await expect(page.getByText("correctChoice")).toHaveCount(0);
});
