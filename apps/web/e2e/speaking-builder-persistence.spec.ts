import { expect, test } from "@playwright/test";

test("builder spaces persist through create, reopen, edit and save", async ({ page, request }, testInfo) => {
  const signup = await request.post("/api/auth/signup", { data: { name: "Builder audit", email: `builder-${Date.now()}@example.test`, password: "speaking-pass" } });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto("/quiz-strike/teacher/speaking/create");
  const values = {
    "Activity name": "Giving Train Directions for Grade 2",
    "Speaking situation": "The student should give directions using the metro map.",
    "AI role": "Confused Tourist",
    "Target expression 1": "Change trains at Osaka Station."
  };
  for (const [label, value] of Object.entries(values)) {
    const input = page.getByRole("textbox", { name: label, exact: true });
    await input.fill("");
    await input.pressSequentially(value);
    await expect(input).toHaveValue(value);
    await expect(input).toBeFocused();
  }
  await page.getByRole("button", { name: "Create Performance Test", exact: true }).last().click();
  await expect(page).toHaveURL(/\/activity\/[^/]+$/);
  const detail = page.url();
  await page.goto(`${detail}/edit`);
  await expect(page.getByRole("heading", { name: "Edit Performance Test" })).toBeVisible();
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
