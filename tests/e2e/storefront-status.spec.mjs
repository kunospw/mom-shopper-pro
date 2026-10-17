import { test } from "@playwright/test";
import assert from "node:assert/strict";
const B = "http://localhost:8099";

async function run(browser, viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  let waOpened = 0;
  await page.route("https://wa.me/**", (r) => { waOpened++; return r.fulfill({ status: 200, contentType: "text/html", body: "<h1>wa</h1>" }); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const mem = (fn) => page.evaluate(fn);
  const start = async () => {
    await page.goto(`${B}/shop/tokomelati`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/shop/tokomelati`);
    await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  };
  const addVoucher = async () => {
    await page.getByRole("button", { name: /^Lihat Voucher Game/ }).click();
    await page.getByRole("heading", { name: "Voucher Game" }).waitFor();
    await page.getByRole("button", { name: /^Tambah · / }).click();
    await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  };

  // 1. Lost response: the order was saved but the reply never came back. Retrying must not duplicate it.
  await start();
  await addVoucher();
  // the tile shows how many are in the order
  await page.getByRole("button", { name: /Lihat Voucher Game, 1 di pesanan/ }).waitFor();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill("Ayu");
  await mem(() => { globalThis.__fail = "after"; });
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByText("Pesanan belum terkirim.").waitFor();
  assert.equal(waOpened, 0, "WhatsApp must not open when saving failed");
  assert.equal(await mem(() => globalThis.__db.orders.length), 1, "saved on the server side");
  await page.getByRole("button", { name: "Coba kirim lagi" }).click();
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  assert.equal(await mem(() => globalThis.__db.orders.length), 1, "retry found the saved order, no duplicate");
  const code = (await page.locator("text=/^#[A-Z0-9]{6}$/").first().innerText()).slice(1);
  assert.equal((await mem(() => globalThis.__db.orders[0].id)).slice(0, 6).toUpperCase(), code);
  // the preview is what will be sent, built from the saved order
  const preview = await page.getByRole("region", { name: "Pesan yang akan dikirim" }).innerText();
  assert(preview.includes(`Pesanan #${code}`) && preview.includes("1× Voucher Game") && preview.includes("Ayu"), preview);
  assert.equal(waOpened, 0, "WhatsApp opens only when the buyer taps it");

  // 2. Nothing saved (connection dropped before writing): retry creates exactly one order.
  await start();
  await addVoucher();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill("Budi");
  await mem(() => { globalThis.__fail = "before"; });
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByText("Pesanan belum terkirim.").waitFor();
  assert.equal(await mem(() => globalThis.__db.orders.length), 0);
  await page.getByRole("button", { name: "Coba kirim lagi" }).click();
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  assert.equal(await mem(() => globalThis.__db.orders.length), 1);
  // double tap on send never creates two orders
  await start();
  await addVoucher();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill("Cici");
  // two taps in the same instant, before React re-renders
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Kirim pesanan via WhatsApp"));
    button.click();
    button.click();
  });
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  assert.equal(await mem(() => globalThis.__db.orders.filter((o) => o.buyerName === "Cici").length), 1);

  // 3. Price change and removal between viewing and sending: review first, then send.
  await start();
  await addVoucher();
  await page.getByRole("button", { name: /^Lihat Tas Rajut/ }).click();
  await page.getByRole("button", { name: /^Tambah · / }).click();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill("Dewi");
  await mem(() => { const d = globalThis.__db; d.products.find((p) => p.id === "p2").price = 55000; d.products.find((p) => p.id === "p3").availability = "unavailable"; });
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByText("Ada yang berubah di katalog.").waitFor();
  await page.getByText("harga baru").waitFor();
  await page.getByText(/dihapus dari pesanan/).waitFor();
  assert.equal(await mem(() => globalThis.__db.orders.length), 0, "nothing sent before review");
  assert((await page.locator("footer").innerText()).includes("55.000"), "new subtotal");
  await page.getByRole("button", { name: "Saya sudah cek, kirim pesanan" }).click();
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  const saved = await mem(() => globalThis.__db.orders[0]);
  assert.equal(saved.items.length, 1);
  assert.equal(saved.subtotal, 55000);

  // 4. Option is required on a product with choices.
  await start();
  await page.getByRole("button", { name: /^Lihat Kemeja Linen/ }).click();
  await page.getByRole("button", { name: "Tambah ke pesanan" }).click();
  await page.getByRole("alert").filter({ hasText: "Pilih warna dulu" }).waitFor();
  await page.getByRole("button", { name: /^Hitam/ }).click();
  await page.getByRole("button", { name: "Tambah · Rp 150.000" }).waitFor();

  // 5. Unavailable product cannot be added; closed shop shows C5.
  await mem(() => { globalThis.__db.products.find((p) => p.id === "p3").availability = "unavailable"; localStorage.setItem("__mockdb_v1", JSON.stringify(globalThis.__db)); });
  await page.goto(`${B}/shop/tokomelati?product=p3`);
  await page.getByText("Belum tersedia", { exact: true }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Belum tersedia" }).isDisabled(), true);
  await mem(() => { globalThis.__db.store.published = false; localStorage.setItem("__mockdb_v1", JSON.stringify(globalThis.__db)); });
  await page.goto(`${B}/shop/tokomelati`);
  await page.getByRole("heading", { name: "Toko ini sedang tutup" }).waitFor();
  await page.getByText("Ditenagai LarisKu").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no overflow");

  assert.deepEqual(errors, [], tag);
  await ctx.close();
  console.log("PASS", tag);
}
test("Toko pembeli dan halaman status pesanan", async ({ browser }, info) => {
  if (info.project.name === "phone") await run(browser, { width: 390, height: 844 }, "mobile");
  else await run(browser, { width: 1280, height: 860 }, "desktop");
});
