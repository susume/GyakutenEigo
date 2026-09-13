import { expect, test } from "@playwright/test";

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
