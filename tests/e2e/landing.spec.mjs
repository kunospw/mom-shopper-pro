import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { freshApp, noHorizontalOverflow } from "./support/helpers.mjs";

/** Signed-out front door: landing page, legal pages, login from an in-app browser, platform credit on shops. */
async function signedOut(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return errors;
}
const serious = async (page, label) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);

test("Landing · signed-out visitor sees the introduction, then signs in", async ({ page }) => {
  const errors = await signedOut(page);
  await page.goto("/?auth=out");
  await page.getByRole("heading", { level: 1, name: /Toko online lewat WhatsApp/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/", "the introduction lives at the front door");
  await page.getByRole("heading", { name: "Harga" }).waitFor();
  await page.getByText("Rp 49.000").first().waitFor();
  await page.getByText("Gratis dicoba 7 hari", { exact: true }).waitFor();
  await noHorizontalOverflow(page, "landing");
  assert.deepEqual(await serious(page, "landing"), []);
  await page.getByRole("link", { name: "Mulai gratis" }).first().click();
  await page.waitForURL(/\/login/);
  await page.getByRole("heading", { name: "Selamat datang" }).first().waitFor();
  await page.getByRole("link", { name: "Kebijakan privasi" }).first().waitFor();
  assert.deepEqual(errors, []);
});

test("Landing · the installed app and deep links go straight to sign-in", async ({ page }) => {
  await signedOut(page);
  await page.goto("/?auth=out&source=pwa");
  await page.waitForURL(/\/login/);
  await page.getByRole("heading", { name: "Selamat datang" }).first().waitFor();
  await page.goto("/sales");
  await page.waitForURL(/\/login/);
});

test("Legal · privacy policy and terms are public", async ({ page }) => {
  const errors = await signedOut(page);
  const problems = [];
  for (const [path, heading, marker] of [
    ["/privasi", "Kebijakan privasi", "Data pembeli"],
    ["/ketentuan", "Syarat & ketentuan", "Kewajiban penjual"],
  ]) {
    await page.goto(`${path}?auth=out`);
    await page.getByRole("heading", { level: 1, name: heading }).waitFor();
    await page.getByRole("heading", { name: new RegExp(marker) }).waitFor();
    await noHorizontalOverflow(page, path);
    problems.push(...(await serious(page, path)));
  }
  await page.getByRole("link", { name: "Kebijakan privasi" }).click();
  await page.waitForURL(/\/privasi/);
  assert.deepEqual(problems, []);
  assert.deepEqual(errors, []);
});

test("Login · an in-app browser gets a way out before sign-in fails", async ({ browser }, info) => {
  const android = "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 340.0.0.22.109 Android";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 musical_ly_35.2.0 BytedanceWebview/d8a21c6";
  for (const [userAgent, app, intent] of [[android, "Instagram", true], [iphone, "TikTok", false]]) {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport, userAgent });
    const page = await ctx.newPage();
    const errors = await signedOut(page);
    await page.goto("/login?auth=out");
    await page.locator(`text=Anda membuka dari ${app}. >> visible=true`).waitFor();
    await page.locator("role=button[name='Salin alamat halaman'] >> visible=true").waitFor();
    const chrome = page.locator("role=link[name='Buka di Chrome'] >> visible=true");
    if (intent) assert.match(await chrome.getAttribute("href"), /^intent:\/\/localhost:8099\/login\?auth=out#Intent;scheme=http;package=com\.android\.chrome;end$/);
    else assert.equal(await chrome.count(), 0, "no Chrome intent on iOS");
    await noHorizontalOverflow(page, app);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test("Shop pages credit the platform and lead new sellers to it", async ({ page }) => {
  await freshApp(page, { seed: true });
  await page.goto("/shop/tokomelati");
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  const link = page.getByRole("link", { name: "Buat toko seperti ini" });
  assert.equal(await link.getAttribute("href"), "/?ref=toko");
  await page.getByText("Ditenagai LarisKu").waitFor();
});

test("Pengaturan · deleting the account needs the typed word", async ({ page }) => {
  const errors = await freshApp(page, { seed: true });
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Hapus akun dan data" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Hapus akun dan semua data?" });
  const confirm = dialog.getByRole("button", { name: "Hapus permanen" });
  assert.equal(await confirm.isDisabled(), true);
  await dialog.getByLabel("Ketik HAPUS untuk melanjutkan").fill("hapus saja");
  assert.equal(await confirm.isDisabled(), true);
  await dialog.getByLabel("Ketik HAPUS untuk melanjutkan").fill(" hapus ");
  assert.equal(await confirm.isDisabled(), false);
  assert.deepEqual(await serious(page, "delete dialog"), []);
  await noHorizontalOverflow(page, "delete dialog");
  await dialog.getByRole("button", { name: "Batal" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
});
