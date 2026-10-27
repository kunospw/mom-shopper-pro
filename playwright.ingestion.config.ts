import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ingestion", testMatch: /.*\.spec\.mjs$/, workers: 1, timeout: 60000,
  reporter: "list", outputDir: "test-results/ingestion",
  use: { baseURL: "http://127.0.0.1:8095", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 1000 } } }, { name: "phone", use: { viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 8095 --strictPort", url: "http://127.0.0.1:8095/login", reuseExistingServer: false,
    env: {
      VITE_FIREBASE_EMULATOR: "1", VITE_FIREBASE_PROJECT_ID: "demo-ingestion",
      VITE_FIREBASE_API_KEY: "demo-api-key", VITE_FIREBASE_AUTH_DOMAIN: "demo-ingestion.firebaseapp.com", VITE_FIREBASE_APP_ID: "demo-app",
      VITE_FIRESTORE_EMULATOR_PORT: "8198", VITE_AUTH_EMULATOR_PORT: "9198", VITE_CATALOGUE_INGESTION: "1",
    },
  },
});
