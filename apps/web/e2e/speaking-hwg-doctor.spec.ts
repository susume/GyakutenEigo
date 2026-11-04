import { expect, test } from "@playwright/test";
import type { SpeakingActivity, SpeakingParticipant, SpeakingSession } from "@quizstrike/shared";

test("HWG DL6 keeps its patient card and five-point rubric from the library through results", async ({ page, request }) => {
  const signup = await request.post("/api/auth/signup", {
    data: { name: "HWG Doctor QA", email: `hwg-doctor-${Date.now()}@example.test`, password: "speaking-pass" }
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };
  await page.addInitScript((value) => localStorage.setItem("quizstrike_token", value), token);
  await page.goto("/quiz-strike/teacher/speaking/core");
  await page.getByLabel("Search scenarios", { exact: true }).fill("HWG Bk2 DL6 Going to the Doctor");
  await expect(page.locator(".speaking-core-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog");
  await preview.getByText("HWG DL6 scoring guide (0–5)", { exact: true }).click();
  await expect(preview).toContainText("A 17–20 · B 11–16 · C 0–10");
  await expect(preview.locator(".speaking-rubric-guide dt")).toHaveCount(24);

  const save = page.waitForResponse((response) => response.url().endsWith("/api/speaking/activities") && response.request().method() === "POST");
  await preview.getByRole("button", { name: "Use as-is", exact: true }).click();
  const saved = await save;
  expect(saved.status()).toBe(201);
  const { activity } = await saved.json() as { activity: SpeakingActivity };
  expect(activity.mode).toBe("assessment");
  expect(activity.supportSettings).toMatchObject({ showContext: true, showTargetExpressions: false, allowHelp: false });

  const launch = await request.post(`/api/speaking/activities/${activity.id}/sessions`, { headers, data: {} });
  expect(launch.status()).toBe(201);
  const { session } = await launch.json() as { session: SpeakingSession };
  expect((await request.post(`/api/speaking/sessions/${session.id}/start-session`, { headers, data: {} })).ok()).toBe(true);
  const join = await request.post("/api/speaking/join", { data: { code: session.joinCode, identifier: "Patient" } });
  expect(join.status()).toBe(201);
  const { participant, token: studentToken } = await join.json() as { participant: SpeakingParticipant; token: string };
  const studentHeaders = { "X-Speaking-Token": studentToken };
  const sessionApi = `/api/speaking/sessions/${session.id}`;
  expect((await request.post(`${sessionApi}/start`, { headers: studentHeaders, data: {} })).ok()).toBe(true);
  await page.addInitScript(({ sessionId, participantId, value }) => {
    sessionStorage.setItem(`speaking-token:${sessionId}`, value);
    sessionStorage.setItem(`speaking-token:${participantId}`, value);
  }, { sessionId: session.id, participantId: participant.id, value: studentToken });
  await page.goto(`/speak/session/${session.id}`);
  const contextButton = page.getByRole("button", { name: "Open Context support", exact: true });
  if (await contextButton.getAttribute("aria-expanded") !== "true") await contextButton.click();
  const card = page.getByRole("tabpanel", { name: "Context", exact: true });
  await expect(card).toContainText("咳、くしゃみ、鼻水");
  await expect(card).toContainText("昨日の夜");
  await expect(card).not.toContainText("No context image");
  await expect(page.locator(".speaking-partner-message p")).toHaveText("Hello. What's the matter?");

  for (const take of ["one", "two"]) {
    const turn = await request.post(`${sessionApi}/turn`, {
      headers: { ...studentHeaders, "Content-Type": "audio/webm", "X-Speaking-Audio-Activity": "true" },
      data: Buffer.from(`mock recording ${take}`)
    });
    expect(turn.ok()).toBe(true);
  }
  expect((await request.post(`${sessionApi}/finish`, { headers: studentHeaders, data: {} })).ok()).toBe(true);
  await page.goto(`/quiz-strike/teacher/speaking/result/${participant.id}`);
  await expect(page.locator(".speaking-detail-score")).toHaveText("20/20 · A");
  await expect(page.locator("meter[max='5']")).toHaveCount(4);
  const csv = await request.get(`${sessionApi}/report.csv`, { headers });
  expect(csv.ok()).toBe(true);
  const report = await csv.text();
  expect(report).toContain("HWG DL6 Points (out of 20),HWG DL6 Grade");
  expect(report).toContain(",20,A,5,5,5,5,");
});
