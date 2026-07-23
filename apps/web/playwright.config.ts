import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const reuseExistingServer = process.env.CI !== "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI === "true" ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run start -w @quizstrike/server",
      cwd: workspaceRoot,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        JWT_SECRET: "playwright-classroom-secret",
        DATABASE_URL: " "
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
