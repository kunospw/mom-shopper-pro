import { test } from "@playwright/test";
import assert from "node:assert/strict";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;

async function run(browser, viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>wa</h1>" }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem("__mockdb_v1") || "null"));
  const patch = async (fn) => {
    await page.evaluate((src) => {
      const d = JSON.parse(localStorage.getItem("__mockdb_v1"));
      new Function("d", src)(d);
      localStorage.setItem("__mockdb_v1", JSON.stringify(d));
    }, fn);
    await page.reload();
  };
  const shot = async (name) => shots && (await page.screenshot({ path: `${shots}/${name}-${tag}.png` }));

  // ---- A: an older open shop gets a grace notice and can start its trial ----
  await page.goto(`${B}/`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${B}/`);
  await page.getByRole("heading", { name: /Halo, Toko Melati/ }).waitFor();
  await page.getByText(/Aktifkan uji coba sebelum/).waitFor();
  await shot("notice-grace");
  await page.getByRole("button", { name: "Mulai uji coba 7 hari" }).click();
  await page.getByText("Uji coba gratis: sisa 7 hari").waitFor();
  await shot("notice-trial");
  let d = await db();
  assert(d.entitlement && d.entitlement.paidUntil === null, "trial recorded");

  // ---- B: buyer orders, seller unpublishes, tracking still works ----
  await page.goto(`${B}/shop/tokomelati`);
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  await page.getByRole("button", { name: /^Lihat Voucher Game/ }).click();
  await page.getByRole("button", { name: /^Tambah · / }).click();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill("Siti");
  await page.getByLabel("Nomor WhatsApp").fill("081234567890");
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  d = await db();
  const order = d.orders[0];
  assert.deepEqual(order.shop, { name: "Toko Melati", whatsapp: "6281234567890", slug: "tokomelati" }, "snapshot stored with the order");
  const status = `${B}/shop/tokomelati/order/${order.id}`;

  await page.goto(`${B}/catalog?store=edit`);
  await page.getByRole("heading", { name: "Toko publik" }).waitFor();
  await page.locator("#store-published").click();
  await page.getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").waitFor();
  d = await db();
  assert.equal(d.store.published, false);

  await page.goto(`${B}/shop/tokomelati`);
  await page.getByRole("heading", { name: "Toko ini sedang tutup" }).waitFor();
  await page.goto(status);
  await page.getByRole("heading", { name: "Penjual sedang memeriksa pesanan Anda" }).waitFor();
  await page.getByText("Toko Melati").first().waitFor();
  assert((await page.getByRole("link", { name: /Chat penjual/ }).getAttribute("href")).includes("6281234567890"));
  await shot("tracking-unpublished");

  // seller still confirms and ships while the shop is closed; the buyer sees timestamps
  await page.goto(`${B}/orders`);
  await page.getByRole("list", { name: "Daftar pesanan" }).getByRole("button").filter({ hasText: "Siti" }).first().click();
  await page.getByRole("link", { name: /Konfirmasi/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Konfirmasi pesanan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();
  d = await db();
  assert(d.orders[0].steps.confirmed, "step time recorded");
  await page.goto(status);
  await page.getByRole("heading", { name: "Pesanan dikonfirmasi penjual" }).waitFor();
  await page.getByText(/\d{1,2} \w{3} · \d{2}[.:]\d{2}/).first().waitFor();
  await shot("tracking-steps");

  // reopen inside the trial
  await page.goto(`${B}/catalog?store=edit`);
  await page.locator("#store-published").click();
  await page.getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").waitFor();
  assert.equal((await db()).store.published, true);

  // ---- C: a brand-new account starts the trial by opening the shop ----
  await patch("d.store.published = false; d.entitlement = null; d.orders = []; d.sales = [];");
  await page.goto(`${B}/catalog?store=edit`);
  await page.getByText("Membuka katalog memulai uji coba gratis 7 hari.").waitFor();
  await page.locator("#store-published").click();
  await page.getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").waitFor();
  d = await db();
  assert(d.entitlement && d.store.published, "first publish starts the trial");
  await page.getByText("Uji coba gratis: sisa 7 hari").waitFor();

  // ---- D: expired trial: closed shop cannot reopen; open shop keeps tracking ----
  await patch(`d.store.published = false; d.entitlement = { trialStartedAt: new Date(Date.now() - 8*86400000).toISOString(), paidUntil: null };`);
  await page.goto(`${B}/catalog?store=edit`);
  await page.getByText("Masa uji coba berakhir, katalog belum bisa dibuka lagi.").waitFor();
  assert.equal(await page.locator("#store-published").isDisabled(), true, "switch locked");
  await page.goto(`${B}/catalog`);
  await page.getByRole("status").filter({ hasText: "Masa uji coba berakhir" }).first().waitFor();
  await shot("notice-expired");
  await page.goto(`${B}/`);
  await page.getByRole("status").filter({ hasText: "Masa uji coba berakhir" }).first().waitFor();

  await patch(`d.store.published = true; d.orders = [{ id: "ordx1", status: "confirmed", progress: "shipped", buyerName: "Rina", note: "", items: [{ productId: "p2", name: "Voucher Game", option: "", kind: "digital", unitPrice: 50000, quantity: 1, availability: "ready", leadTime: "" }], subtotal: 50000, trackingNo: "JNE 1", sellerNote: "", shop: { name: "Toko Melati", whatsapp: "6281234567890", slug: "tokomelati" }, steps: { confirmed: new Date().toISOString() }, createdAt: new Date().toISOString() }];`);
  await page.goto(`${B}/shop/tokomelati/order/ordx1`);
  await page.getByRole("heading", { name: /sudah dikirim|menuju Anda|selesai|dikonfirmasi/ }).first().waitFor();
  await page.getByText("Toko Melati").first().waitFor();

  assert.deepEqual(errors, [], tag);
  await ctx.close();
  console.log("PASS", tag);
}
test("Uji coba: buka toko memulai trial, masa berakhir, toko tutup", async ({ browser }, info) => {
  if (info.project.name === "phone") await run(browser, { width: 390, height: 844 }, "mobile");
  else await run(browser, { width: 1280, height: 860 }, "desktop");
});
