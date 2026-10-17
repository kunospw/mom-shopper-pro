import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
const newOrder = (id, buyer) => `
  d.orders.push({ id: "${id}", status: "pending", progress: "pending", buyerName: "${buyer}", note: "", items: [{ productId: "p1", name: "Kemeja Linen", option: "Hitam", kind: "physical", unitPrice: 150000, quantity: 2, availability: "ready", leadTime: "" }], subtotal: 300000, trackingNo: "", sellerNote: "", shop: { name: d.store.name, whatsapp: d.store.whatsapp, slug: d.store.slug }, steps: {}, createdAt: new Date().toISOString() });`;
for (const [w, h, tag] of [[1440, 1000, "d"], [390, 844, "m"]]) {
  test(`Notifikasi pesanan baru dan pengaturan aplikasi · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.grantPermissions(["notifications"], { origin: B });
    // Record system notifications and chimes instead of showing them.
    await ctx.addInitScript(() => {
      window.__notes = [];
      window.__chimes = 0;
      class FakeNotification {
        static permission = "granted";
        static requestPermission = async () => "granted";
        constructor(title, options) { window.__notes.push({ title, ...options }); }
      }
      window.Notification = FakeNotification;
      const Real = window.AudioContext;
      window.AudioContext = class extends Real { constructor() { super(); window.__chimes++; } };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const patchDb = (src) => page.evaluate((s) => { const d = globalThis.__db; new Function("d", s)(d); localStorage.setItem("__mockdb_v1", JSON.stringify(d)); }, src);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await page.reload();
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.waitForTimeout(1000);
    assert.equal(await page.getByText(/Pesanan baru dari/).count(), 0, "existing orders are not announced");

    // a buyer sends an order while the owner is on Beranda
    await patchDb(newOrder("newx0001", "Rina Wati"));
    await page.getByText("Pesanan baru dari Rina Wati").waitFor({ timeout: 5000 });
    await page.getByText(/^#\w+ · 1 produk · Rp\s?300\.000$/).first().waitFor();
    const notes = await page.evaluate(() => window.__notes);
    assert.equal(notes.length, 1, "system notification when not on Pesanan");
    assert.equal(notes[0].title, "Pesanan baru dari Rina Wati");
    assert.equal(notes[0].data.url, "/orders?id=newx0001");
    assert.ok((await page.evaluate(() => window.__chimes)) >= 1, "chime played");
    // counts refresh
    if (tag === "d") await page.getByRole("link", { name: "Pesanan, 4 menunggu" }).waitFor();
    if (shots) await page.screenshot({ path: `${shots}/order-alert-${tag}.png` });
    // "Lihat" opens that order
    await page.getByRole("button", { name: "Lihat" }).first().click();
    await page.waitForURL(/\/orders\?id=newx0001/);
    await page.getByText("Rina Wati").first().waitFor();

    // turn off sound and screen notifications in Pengaturan -> Tampilan
    await page.goto(`${B}/settings/appearance`);
    await page.getByRole("heading", { name: "Aplikasi & notifikasi" }).waitFor();
    await page.getByText("Notifikasi diizinkan.").waitFor();
    await page.getByRole("switch", { name: "Bunyi" }).click();
    await page.getByRole("switch", { name: "Notifikasi di layar" }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("ruang-usaha:order-alerts"))), { sound: false, notify: false });
    if (shots) await page.screenshot({ path: `${shots}/app-settings-${tag}.png`, fullPage: true });
    const chimes = await page.evaluate(() => window.__chimes);
    await patchDb(newOrder("newx0002", "Sinta"));
    await page.getByText("Pesanan baru dari Sinta").waitFor({ timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__notes.length), 0, "no system notification when off (new page load)");
    assert.equal(await page.evaluate(() => window.__chimes), chimes, "no chime when off");

    // install entry hidden where the browser offers no install (dev, no prompt) and not iOS
    assert.equal(await page.getByRole("button", { name: "Pasang aplikasi" }).count(), 0);
    // offline strip
    await ctx.setOffline(true);
    await page.getByText("Anda sedang offline.").waitFor();
    await ctx.setOffline(false);
    await page.getByText("Anda sedang offline.").waitFor({ state: "detached" });

    assert.deepEqual(errors, []);
    console.log(`PASS order alerts + app settings ${tag}`);
    await ctx.close();
  });
}
