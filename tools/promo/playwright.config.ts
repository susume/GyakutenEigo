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
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  outputDir: "../../test-results/promo-capture",
  use: {
    ...devices["Desktop Chrome"],
    ...(installedChromePath ? { launchOptions: { executablePath: installedChromePath } } : {}),
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: "reduce" },
    video: { mode: "on", size: { width: 1920, height: 1080 } },
    trace: "off",
    screenshot: "off"
  },
  webServer: [
    {
      command: "npm run start -w @quizstrike/server",
      cwd: workspaceRoot,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        JWT_SECRET: "playwright-promo-capture-secret",
        DATABASE_URL: " "
      },
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm run preview -w @quizstrike/web -- --host 127.0.0.1 --port 4173 --strictPort",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:4173/join",
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
