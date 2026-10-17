#!/usr/bin/env node
/**
 * Runs a test command against local Firebase emulators, never a real project.
 *
 *   node scripts/test-emulators.mjs rules        # Firestore rules suites
 *   node scripts/test-emulators.mjs integration  # app + Auth/Firestore emulators (Playwright)
 *
 * The emulator tooling (firebase-tools, @firebase/rules-unit-testing) stays out
 * of the app's dependencies: it is installed once into CATALOG_TEST_TOOLING, or
 * node_modules/.cache/larisku-test-tools when that is unset. Needs Java 21+.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const suites = {
  rules: {
    config: "firebase/emulators.json",
    project: "demo-catalog-tests",
    only: "firestore",
    command: "node tests/catalog/rules.mjs && node tests/catalog/rules-subscription.mjs",
  },
  integration: {
    config: "firebase/emulators.e2e.json",
    project: "demo-larisku",
    only: "auth,firestore",
    command: `npx playwright test -c playwright.integration.config.ts ${process.argv.slice(3).join(" ")}`.trim(),
  },
};
const suite = suites[process.argv[2]];
if (!suite) {
  console.error(`Usage: node scripts/test-emulators.mjs <${Object.keys(suites).join("|")}> [playwright args]`);
  process.exit(2);
}
// demo- projects cannot reach real Firebase services, even by mistake.
if (!suite.project.startsWith("demo-")) throw new Error("Emulator tests must use a demo- project.");

const tools = resolve(process.env.CATALOG_TEST_TOOLING || "node_modules/.cache/larisku-test-tools");
const firebase = resolve(tools, "node_modules/.bin/firebase");
if (!existsSync(firebase) || !existsSync(resolve(tools, "node_modules/@firebase/rules-unit-testing"))) {
  mkdirSync(tools, { recursive: true });
  console.log(`Installing emulator tooling into ${tools} …`);
  execFileSync("npm", ["install", "--prefix", tools, "--no-package-lock", "--no-save", "firebase-tools@15.34.0", "@firebase/rules-unit-testing@5.0.0", "firebase@12.4.0"], { stdio: "inherit" });
}

const env = {
  ...process.env,
  CATALOG_TEST_TOOLING: tools,
  FIREBASE_EMULATORS_PATH: resolve(tools, "emulators"),
  XDG_CONFIG_HOME: resolve(tools, "config"),
  XDG_CACHE_HOME: resolve(tools, "cache"),
};
const result = spawnSync(firebase, ["emulators:exec", "--config", suite.config, "--project", suite.project, "--only", suite.only, suite.command], { stdio: "inherit", env });
process.exit(result.status ?? 1);
