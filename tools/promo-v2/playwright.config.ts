import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const installedChromePath = [
  process.env.ProgramFiles ? join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe") : undefined,
  process.env["ProgramFiles(x86)"] ? join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe") : undefined,
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : undefined
].find((candidate) => candidate && existsSync(candidate));

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: "line",
  outputDir: "../../test-results/promo-v2",
  use: {
    ...devices["Desktop Chrome"],
    ...(installedChromePath ? { launchOptions: { executablePath: installedChromePath } } : {}),
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: "reduce" },
    video: { mode: "on", size: { width: 1920, height: 1080 } },
    trace: "off",
    screenshot: "off"
  },
  webServer: [
    {
      command: "npm run dev -w @quizstrike/server",
      cwd: workspaceRoot,
      env: {
        PORT: "4002",
        NODE_ENV: "test",
        JWT_SECRET: "playwright-promo-v2-secret",
        DATABASE_URL: " ",
        QUIZSTRIKE_TEST_ROUND_PREPARATION_MS: "12000"
      },
      url: "http://127.0.0.1:4002/api/health",
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm run dev -w @quizstrike/web -- --host 127.0.0.1 --port 4175 --strictPort",
      cwd: workspaceRoot,
      env: { VITE_API_URL: "http://127.0.0.1:4002" },
      url: "http://127.0.0.1:4175/join",
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
