import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

// Runs against the production build served by `vite preview` (see playwright.config.ts).
const B = "http://localhost:8097";
const swFile = new URL("../../test-results/pwa-dist/sw.js", import.meta.url);

test("PWA: installable, offline, Firebase never cached, buyer pages excluded, update flow", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "one run is enough; installed apps are mostly phones");
  const original = readFileSync(swFile, "utf8");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated", null, { timeout: 15000 });
    await page.reload();
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), "controlled by the service worker");

    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(installabilityErrors, [], JSON.stringify(installabilityErrors));
    const manifest = await cdp.send("Page.getAppManifest");
    assert.equal(manifest.errors.length, 0, JSON.stringify(manifest.errors));
    assert.equal(JSON.parse(manifest.data).short_name, "LarisKu");

    await ctx.setOffline(true);
    await page.goto(`${B}/sales`);
    await page.getByText("Anda sedang offline.").waitFor();
    await page.getByRole("heading", { name: "Penjualan" }).waitFor();
    await ctx.setOffline(false);

    const cachedFirebase = await page.evaluate(async () => {
      const urls = [];
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(r.url);
      return urls.filter((u) => /googleapis\.com\/(?!css)|firestore|identitytoolkit|firebase/.test(u));
    });
    assert.deepEqual(cachedFirebase, []);

    const buyer = await ctx.newPage();
    await buyer.goto(`${B}/shop/tokomelati`);
    await buyer.waitForTimeout(800);
    assert.equal(await buyer.evaluate(() => !!document.querySelector('link[rel="manifest"]')), false, "no install on buyer pages");

    // Simulate a deploy: the served sw.js changes.
    const current = original.match(/const VERSION = "([^"]+)"/)[1];
    writeFileSync(swFile, original.replace(`const VERSION = "${current}"`, `const VERSION = "${current}-next"`));
    await page.reload();
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page.getByText("Versi baru tersedia").waitFor({ timeout: 15000 });
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Muat ulang" }).click()]);
    await page.getByRole("heading", { name: "Penjualan" }).waitFor();
    const keys = await page.evaluate(async () => caches.keys());
    assert.ok(keys.some((k) => k.endsWith(`${current}-next`)), "new caches");
    assert.ok(!keys.some((k) => k.endsWith(`-${current}`)), "old caches removed");
    assert.deepEqual(errors, []);
  } finally {
    writeFileSync(swFile, original);
    await ctx.close();
  }
});
