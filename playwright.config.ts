import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  expect: { timeout: 4000 },
  fullyParallel: false,
  workers: 1,
  // Service workers are blocked by default so page.route() can see every request; pwa.spec.ts opts back in.
  use: { ...devices["iPhone 14"], baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" },
  webServer: {
    command: "node tests/e2e/serve.mjs",
    url: "http://127.0.0.1:4173/Alpha-Note",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
