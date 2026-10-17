import { defineConfig } from "@playwright/test";

/**
 * Mocked browser tests (tests/e2e): the real app with storage and auth mocked,
 * no network and no Firebase. Each spec runs on a desktop and a phone project;
 * specs that only make sense on one size skip the other.
 * The emulator suite has its own config: playwright.integration.config.ts.
 */
const mockConfig = "tests/e2e/mock/vite.config.ts";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/e2e-report" }]],
  outputDir: "test-results/e2e",
  use: {
    baseURL: "http://localhost:8099",
    actionTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: `npx vite --config ${mockConfig}`,
      url: "http://localhost:8099",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Production build of the mocked app, for the service worker / PWA spec.
      command: `npx vite build --config ${mockConfig} --outDir test-results/pwa-dist --emptyOutDir && npx vite preview --config ${mockConfig} --outDir test-results/pwa-dist`,
      url: "http://localhost:8097",
      reuseExistingServer: true,
      timeout: 240_000,
    },
  ],
});
