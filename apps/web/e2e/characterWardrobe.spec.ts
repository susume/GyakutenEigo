import { expect, test, type Page } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

async function join(page: Page, code: string) {
  await page.goto(`/join?code=${code}`);
  await page.getByPlaceholder("Player name").fill("Wardrobe student");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("region", { name: "Player style" })).toBeVisible();
  await expect(page.locator(".character-preview")).toHaveAttribute("data-ready", "true");
}

test("the complete wardrobe saves and keeps one preview canvas while switching slots", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /shader|THREE|WebGL/.test(message.text())) errors.push(message.text()); });
  const classroom = await createClassroom(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await join(page, classroom.code);
  const canvas = await page.locator(".character-preview canvas").elementHandle();
  expect(canvas).toBeTruthy();
  const counts = [10, 10, 6, 4];
  for (const [index, category] of ["Head", "Back", "Footwear", "Victory pose"].entries()) {
    await page.getByRole("tab", { name: category, exact: true }).click();
    await expect(page.locator(".wardrobe-item-grid > button")).toHaveCount(counts[index]);
    const images = page.locator(".wardrobe-item-grid img");
    for (let i = 0; i < await images.count(); i++) {
      await images.nth(i).scrollIntoViewIfNeeded();
      await expect.poll(() => images.nth(i).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(512);
    }
  }
  await page.getByRole("tab", { name: "Head", exact: true }).click();
  await page.getByRole("button", { name: "Fox", exact: true }).click();
  await page.getByRole("tab", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Samurai Sword", exact: true }).click();
  await page.getByRole("tab", { name: "Footwear", exact: true }).click();
  await page.getByRole("button", { name: "Basketball Shoes", exact: true }).click();
  await page.getByRole("tab", { name: "Victory pose", exact: true }).click();
  await page.getByRole("button", { name: "Friendly wave", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Player style saved" })).toBeVisible({ timeout: 15_000 });
  const state = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const payload = await state.json();
  expect(payload.session.players[0].appearance).toMatchObject({ headStyleId: "fox", backAccessoryId: "samurai_sword", footwearId: "basketball_shoes", victoryPoseId: "wave" });
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Replay pose", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Rotate player left", exact: true }).click();
  expect(errors).toEqual([]);
  await page.getByRole("tab", { name: "Head", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Back", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Back", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("drawing badges preview, upload and persist when the teacher enables them", async ({ page, request }) => {
  const classroom = await createClassroom(request);
  const policy = await request.put(`/api/sessions/${classroom.code}/customization`, {
    headers: { Authorization: `Bearer ${classroom.teacherToken}` },
    data: { enabled: true, uploadsEnabled: true, aiEnabled: false, persistAcrossSessions: false }
  });
  expect(policy.ok()).toBe(true);
  await join(page, classroom.code);
  const canvas = await page.locator(".character-preview canvas").elementHandle();
  await page.locator("summary").filter({ hasText: "Your signature badge" }).click();
  await page.getByRole("button", { name: "Add a lightning bolt", exact: true }).click();
  await page.getByRole("button", { name: "Preview badge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Discard badge preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use badge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove badge", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Player style saved" })).toBeVisible({ timeout: 15_000 });
  const state = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
  const payload = await state.json();
  expect(payload.session.players[0].appearance.decalAssetId).toMatch(/^[0-9a-f-]{36}$/);
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
});

test("athletics only offers non-combat outfits and badge upload controls respect teacher policy", async ({ page, request }) => {
  const classroom = await createClassroom(request, { gameMode: "athletics" });
  await page.goto(`/join?code=${classroom.code}`);
  await page.getByPlaceholder("Player name").fill("Runner wardrobe");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("region", { name: "Player style" })).toBeVisible();
  await page.getByRole("tab", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Samurai Sword", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Twin Swords", exact: true })).toHaveCount(0);
  await expect(page.locator(".wardrobe-badge-editor")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Arena gear", exact: true })).toHaveCount(0);
});
