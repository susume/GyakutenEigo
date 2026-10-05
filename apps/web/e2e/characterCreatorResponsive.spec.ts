import { expect, test, type Page } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

const joinWaitingRoom = async (page: Page, code: string, nickname: string) => {
  await page.goto(`/join?code=${code}`);
  await page.getByPlaceholder("Player name").fill(nickname);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByTestId("student-lobby-status")).toBeVisible();
  await expect(page.getByRole("region", { name: "Player style" })).toBeVisible();
};

test("Zeus waiting room gives students room to customize and save their player", async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const classroom = await createClassroom(request, { gameMode: "athletics", athleticsMode: "zeus" });
  await joinWaitingRoom(page, classroom.code, "Zeus stylist");
  const header = await page.getByTestId("student-lobby-status").boundingBox();
  const preview = await page.locator(".character-creator-preview-column").boundingBox();
  const menu = await page.locator(".creator-controls-scroll").boundingBox();
  expect(header!.height).toBeLessThan(90);
  expect(preview!.height).toBeGreaterThan(250);
  expect(menu!.height).toBeGreaterThan(180);
  await expect(page.locator(".athletics-briefing")).toHaveCount(0);
  await page.getByRole("tab", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Utility Pack", exact: true }).click();
  const save = page.getByRole("button", { name: "Save style", exact: true });
  const footer = await page.locator(".creator-footer").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(720);
  await save.click();
  await expect(save).toBeHidden();
  await expect.poll(async () => {
    const snapshot = await request.get(`/api/sessions/${classroom.code}`, { headers: { Authorization: `Bearer ${classroom.teacherToken}` } });
    const { session } = await snapshot.json();
    return session.players[0].appearance.backAccessoryId;
  }).toBe("utility_pack");
  await page.screenshot({ path: testInfo.outputPath("zeus-player-customization.png") });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 650 },
  { name: "tablet landscape", width: 1024, height: 768 }
]) {
  test(`player style menu scrolls inside the viewport on ${viewport.name}`, async ({ page, request }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const classroom = await createClassroom(request);
    await joinWaitingRoom(page, classroom.code, `${viewport.name} player`);

    await page.getByRole("tab", { name: "Back", exact: true }).click();
    const menu = page.locator(".creator-controls-scroll");
    const metrics = await menu.evaluate((element) => {
      const node = element as HTMLElement;
      return {
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        overflowY: getComputedStyle(node).overflowY
      };
    });

    expect(metrics.overflowY).toBe("auto");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    await menu.evaluate((element) => {
      const node = element as HTMLElement;
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => menu.evaluate((element) => (element as HTMLElement).scrollTop)).toBeGreaterThan(0);
    await expect(page.locator(".creator-footer")).toBeVisible();
  });
}

test("player style page remains vertically reachable without horizontal overflow on a phone", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const classroom = await createClassroom(request);
  await joinWaitingRoom(page, classroom.code, "Phone player");

  await page.getByRole("tab", { name: "Back", exact: true }).click();
  const layout = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  await page.locator(".creator-footer").scrollIntoViewIfNeeded();
  await expect(page.locator(".creator-footer")).toBeVisible();
});
