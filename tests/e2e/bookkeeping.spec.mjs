import { test } from "@playwright/test";
import assert from "node:assert/strict";
async function run(browser, viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:8099/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  await page.goto("http://localhost:8099/sales");
  await page.getByRole("heading", { name: "Penjualan" }).waitFor();
  await page.getByText("Belum ada penjualan").waitFor();

  // 1) physical sale from catalog with DP
  await page.getByRole("main").getByRole("button", { name: /Catat penjualan/ }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Siti");
  await page.getByLabel("Nomor WhatsApp").fill("+62 812-3456-7890");
  await page.getByRole("button", { name: "Pilih dari katalog" }).click();
  await page.getByRole("list", { name: "Produk katalog" }).getByRole("button", { name: /Kemeja Linen/ }).click();
  await page.getByLabel("Jumlah", { exact: true }).first().fill("2");
  await page.getByLabel("Ongkir", { exact: true }).fill("15000");
  await page.getByLabel("Diskon", { exact: true }).fill("5000");
  await page.getByLabel("DP / bayar sekarang").fill("100000");
  const summary = page.getByRole("region", { name: "Ringkasan penjualan" });
  await summary.waitFor();
  const txt = await summary.innerText();
  assert(/310\.000/.test(txt), "total 2x150k+15k-5k=310k: " + txt);
  assert(/210\.000/.test(txt), "balance 210k: " + txt);
  await page.getByRole("button", { name: "Simpan penjualan" }).click();
  // detail sheet opens
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();
  const stock1 = await page.evaluate(() => globalThis.__db.inventory.p1.stock);
  assert.equal(stock1, 3, "stock 5-2");
  // overpay rejected
  await page.getByRole("button", { name: "Tambah pembayaran" }).click();
  await page.getByLabel("Jumlah pembayaran").fill("999999");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "melebihi sisa" }).waitFor();
  // pay the rest
  await page.getByRole("button", { name: /Isi sisa tagihan/ }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.getByRole("dialog").getByText("Lunas").first().waitFor();
  assert.equal(await page.evaluate(() => globalThis.__db.sales[0].paymentState), "paid");
  // fulfil: packed -> shipped with tracking
  await page.getByRole("button", { name: /Tandai sudah dikemas/ }).click();
  await page.getByLabel("Kurir").fill("JNE");
  await page.getByLabel("Nomor resi").fill("JNE123");
  await page.getByRole("button", { name: /Tandai sudah dikirim/ }).click();
  await page.getByRole("button", { name: /Tandai selesai/ }).waitFor();
  assert.deepEqual(await page.evaluate(() => [globalThis.__db.sales[0].fulfillment.courier, globalThis.__db.sales[0].fulfillment.trackingNo]), ["JNE", "JNE123"]);
  assert.equal(await page.getByLabel("Nomor resi").inputValue(), "JNE123");
  const waHref = await page.getByRole("link", { name: /Kabari pelanggan/ }).getAttribute("href");
  assert(waHref.startsWith("https://wa.me/6281234567890?text="), waHref);
  // invoice shows shipping, discount and payments
  await page.getByRole("button", { name: "Invoice" }).click();
  const inv = page.locator(".invoice-paper");
  await inv.waitFor();
  const it = await inv.innerText();
  assert(/Ongkos kirim/.test(it) && /Diskon/.test(it) && /Dibayar/.test(it) && /Lunas/.test(it), it);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // 2) digital sale skips shipping steps
  await page.getByRole("main").getByRole("button", { name: /Catat penjualan/ }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Siti");
  await page.getByRole("button", { name: "Pilih dari katalog" }).click();
  await page.getByRole("list", { name: "Produk katalog" }).getByRole("button", { name: /Voucher Game/ }).click();
  await page.getByText("Semua produk digital").waitFor();
  await page.getByRole("button", { name: "Simpan penjualan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-002 · Siti/ }).waitFor();
  await page.getByLabel(/Catatan pengiriman digital/).fill("KODE-ABC");
  await page.getByRole("button", { name: /Tandai sudah terkirim/ }).click();
  await page.getByRole("button", { name: /Tandai selesai/ }).waitFor();
  assert.equal(await page.evaluate(() => globalThis.__db.sales.find((s) => s.number.endsWith("002")).fulfillment.deliveryNote), "KODE-ABC");
  assert.equal(await page.getByLabel("Nomor resi").count(), 0);
  // cancel returns nothing for untracked; cancel sale 1 restores stock
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /INV-\d{4}-001/ }).click();
  await page.getByRole("button", { name: "Tindakan lain" }).click();
  await page.getByRole("menuitem", { name: /Batalkan penjualan/ }).click();
  await page.getByRole("dialog").getByText("Dibatalkan").first().waitFor();
  assert.equal(await page.evaluate(() => globalThis.__db.inventory.p1.stock), 5, "cancel restores stock");
  await page.getByRole("button", { name: "Tindakan lain" }).click();
  await page.getByRole("menuitem", { name: /Buka kembali/ }).click();
  await page.getByRole("button", { name: /Tandai/ }).first().waitFor();
  assert.equal(await page.evaluate(() => globalThis.__db.inventory.p1.stock), 3, "reopen takes stock again");
  await page.keyboard.press("Escape");

  // 3) expense reduces net profit in overview
  await page.goto("http://localhost:8099/costs?new=expense");
  await page.getByLabel("Jumlah biaya").fill("20000");
  await page.getByRole("button", { name: "Simpan biaya" }).click();
  await page.getByText("Ongkir").first().waitFor();
  await page.goto("http://localhost:8099/");
  await page.getByRole("heading", { name: "Perlu tindakan" }).waitFor();
  const body = await page.locator("main").innerText();
  assert(/Total pengeluaran/.test(body) && /Keuntungan bersih/.test(body) && /Transaksi terbaru/.test(body), body);
  await page.goto("http://localhost:8099/customers");
  await page.locator("text=Siti >> visible=true").first().waitFor();
  await page.goto("http://localhost:8099/reports");
  await page.getByText("Produk terlaris").waitFor();
  // no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "horizontal overflow on " + tag);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/bookkeeping-${tag}.png` });
  const real = errors.filter((e) => !/favicon|Download the React DevTools|fonts\.g|ERR_FAILED|net::/.test(e));
  assert.deepEqual(real, [], "console errors: " + real.join("\n"));
  await ctx.close();
  console.log("PASS", tag);
}
test("Pencatatan: penjualan, DP, pengiriman, invoice, biaya, digital", async ({ browser }, info) => {
  if (info.project.name === "phone") await run(browser, { width: 390, height: 844 }, "mobile");
  else await run(browser, { width: 1280, height: 900 }, "desktop");
});
