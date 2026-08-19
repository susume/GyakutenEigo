import { expect, test, type Page } from "@playwright/test";
import { createClassroom } from "./classroomFixture";

const joinWaitingRoom = async (page: Page, code: string, nickname: string) => {
  await page.goto(`/join?code=${code}`);
  await page.getByPlaceholder("Player name").fill(nickname);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your team, then wait for the host to start." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Player style" })).toBeVisible();
};

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
