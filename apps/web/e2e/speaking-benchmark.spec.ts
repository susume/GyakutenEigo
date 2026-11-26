import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const sample = process.env.SPEAKING_E2E_WAV;
test.skip(!sample || process.env.VITE_SPEAKING_LOCAL_DIAGNOSTICS !== "true", "Requires the diagnostics build and a synthetic WAV.");

test("speech benchmarking exports cold and cached timings and word counts without transcript text", async ({ page }) => {
  test.setTimeout(220_000);
  await page.addInitScript(() => localStorage.setItem("gyakuteneigo.language", "en"));
  await page.goto("/speak/prepare");
  await page.getByLabel("Processing backend").selectOption("wasm");
  await page.getByRole("button", { name: "Prepare speech model" }).click();
  await expect(page.getByText(/Startup with model downloads/u)).toBeVisible({ timeout: 180_000 });
  await page.getByRole("button", { name: "Test cached startup" }).click();
  await expect(page.getByText(/Cached startup/u)).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Or choose an audio file").setInputFiles(sample!);
  await page.getByLabel("Reference transcript for measurement").fill("I like reading books.");
  await page.getByRole("button", { name: "Run speech recognition" }).click();
  await expect(page.getByText(/Word error rate/u)).toBeVisible({ timeout: 45_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export benchmark measurements" }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  const raw = await readFile(path!, "utf8");
  const metrics = JSON.parse(raw);
  expect(metrics.startups).toHaveLength(2);
  expect(metrics.startups[0].downloadedBytes).toBeGreaterThan(0);
  expect(metrics.startups[1].downloadedBytes).toBe(0);
  expect(metrics.benchmarkRuns).toHaveLength(1);
  expect(metrics.benchmarkRuns[0].referenceWords).toBe(4);
  expect(metrics.benchmarkRuns[0].recognizedWords).toBeGreaterThan(0);
  expect(raw).not.toContain("I like reading books.");
  expect(raw).not.toContain(sample);
});
