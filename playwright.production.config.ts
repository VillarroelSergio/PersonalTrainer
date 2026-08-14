import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 5"] } }]
});
