import { expect, test } from "@playwright/test";

test("the production build serves indexable English and Japanese pages without JavaScript", async ({ browser, baseURL, request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const urls = Array.from((await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/gu), (match) => match[1]!);
  expect(urls).toHaveLength(10);
  expect(new Set(urls).size).toBe(urls.length);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://gyakuteneigo.com/sitemap.xml");

  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const url of urls) {
      const { origin, pathname } = new URL(url);
      expect(origin).toBe("https://gyakuteneigo.com");
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(200);
      const language = pathname.startsWith("/ja/") ? "ja" : "en";
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", url);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/u);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
      for (const locale of ["en", "ja"]) {
        const alternate = await page.locator(`link[rel="alternate"][hreflang="${locale}"]`).getAttribute("href");
        expect(urls).toContain(alternate);
      }
    }

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open SpeakCheck", exact: true })).toHaveAttribute("href", "/speak/");
    await page.getByRole("link", { name: "日本語", exact: true }).click();
    await expect(page).toHaveURL(/\/ja\/$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  } finally {
    await context.close();
  }

  const join = await request.get("/join/");
  expect(join.ok()).toBeTruthy();
  expect(await join.text()).toContain('name="robots" content="noindex"');
});

test("the language picker opens the matching public URL and classroom controls hydrate", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/speak/");
  const languagePicker = page.getByRole("combobox", { name: "Language / 言語" });
  await languagePicker.selectOption("ja");
  await expect(page).toHaveURL(/\/ja\/speak\/$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");

  await languagePicker.selectOption("en");
  await expect(page).toHaveURL(/\/speak\/$/u);
  await page.getByRole("button", { name: "Join with Code", exact: true }).click();
  await expect(page).toHaveURL(/\/speak\/join$/u);
  await expect(page.getByRole("button", { name: "Join speaking task", exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  expect(errors).toEqual([]);
});
