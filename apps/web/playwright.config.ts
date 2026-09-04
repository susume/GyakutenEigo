import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const reuseExistingServer = process.env.CI !== "true";
const installedChromePath = [
  process.env.ProgramFiles ? join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe") : undefined,
  process.env["ProgramFiles(x86)"] ? join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe") : undefined,
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : undefined
].find((candidate) => candidate && existsSync(candidate));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI === "true" ? [["line"], ["html", { open: "never" }]] : "line",
  projects: [
    {
      name: "desktop-chrome",
      testIgnore: /ipad\.spec\.ts$/u,
      use: {
        ...devices["Desktop Chrome"],
        ...(installedChromePath ? { launchOptions: { executablePath: installedChromePath } } : {}),
        baseURL: "http://127.0.0.1:4173",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: process.env.CI === "true" ? "retain-on-failure" : "off"
      }
    },
    {
      name: "ipad-like",
      testMatch: /ipad\.spec\.ts$/u,
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
        ...(installedChromePath ? { launchOptions: { executablePath: installedChromePath } } : {}),
        baseURL: "http://127.0.0.1:4173",
        contextOptions: { reducedMotion: "reduce" },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: process.env.CI === "true" ? "retain-on-failure" : "off"
      }
    }
  ],
  webServer: [
    {
      command: "npm run start -w @quizstrike/server",
      cwd: workspaceRoot,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        JWT_SECRET: "playwright-classroom-secret",
        DATABASE_URL: " ",
        QUIZSTRIKE_TEST_ROUND_PREPARATION_MS: "5000"
      },
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer,
      timeout: 120_000
    },
    {
      command: "npm run preview -w @quizstrike/web -- --host 127.0.0.1 --port 4173 --strictPort",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:4173/join",
      reuseExistingServer,
      timeout: 120_000
    }
  ]
});
