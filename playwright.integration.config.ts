import { defineConfig } from "@playwright/test";

/**
 * Integration suite: the real app (real Firestore/Auth code and real security
 * rules) against the local Firebase emulators. Run with `npm run test:integration`,
 * which starts the emulators first. Only the `demo-larisku` project is used;
 * Firebase never connects a demo- project to real services.
 */
const PORT = 8096;
export const PROJECT_ID = "demo-larisku";

export default defineConfig({
  testDir: "tests/integration",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 180_000,
  // one shared emulator; every test resets it, so tests run one at a time
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "test-results/integration-report", open: "never" }]],
  outputDir: "test-results/integration",
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  projects: [{ name: "desktop" }],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_FIREBASE_EMULATOR: "1",
      VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
      VITE_FIREBASE_APP_ID: "demo-app",
      VITE_FIRESTORE_EMULATOR_PORT: "8088",
      VITE_AUTH_EMULATOR_PORT: "9099",
      // shop assistant: the real handler, against a fake Ollama server the test runs
      VITE_SHOP_ASSISTANT: "1",
      OLLAMA_API_KEY: "test-key",
      OLLAMA_HOST: "http://127.0.0.1:11499",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8088",
    },
  },
});
