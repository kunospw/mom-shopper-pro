import { test } from "@playwright/test";
import assert from "node:assert/strict";
const B = "http://localhost:8099";

async function run(browser, viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const waUrls = [];
  await page.route("https://wa.me/**", (r) => { waUrls.push(r.request().url()); return r.fulfill({ status: 200, contentType: "text/html", body: "<h1>wa</h1>" }); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem("__mockdb_v1") || "null"));
  const orderFromBuyer = async (name, product) => {
    await page.goto(`${B}/shop/tokomelati`);
    await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
    await page.getByRole("button", { name: new RegExp(`^Lihat ${product}`) }).click();
    await page.getByRole("button", { name: /^Tambah · / }).click();
    await page.getByRole("button", { name: /Lihat pesanan/ }).click();
    await page.getByLabel("Nama Anda").fill(name);
    await page.getByLabel("Nomor WhatsApp").fill("081234567890");
  };
  // B6: saved first, then the buyer opens WhatsApp from the confirmation screen.
  const sendAndOpenWhatsApp = async () => {
    await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
    await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
    const href = await page.getByRole("link", { name: "Buka WhatsApp" }).getAttribute("href");
    await page.getByRole("link", { name: "Buka WhatsApp" }).click();
    await page.waitForURL(/wa\.me/);
    return decodeURIComponent(href);
  };

  // ---------- buyer ----------
  await page.goto(`${B}/shop/tokomelati`);
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  assert.equal(await page.getByText("Produk Draft").count(), 0, "drafts hidden");
  await page.getByRole("button", { name: "Semua · 3" }).waitFor();
  await page.getByRole("button", { name: /^Lihat Voucher Game/ }).click();
  await page.getByRole("button", { name: /^Tambah · / }).click();
  await page.getByRole("button", { name: /^Lihat Kemeja Linen/ }).click();
  await page.getByRole("button", { name: /^Putih/ }).click();
  const addBtn = page.getByRole("button", { name: /^Tambah · / });
  assert((await addBtn.innerText()).includes("160.000"), "option price shown");
  await addBtn.click();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByRole("heading", { name: "Pesanan saya" }).waitFor();
  assert((await page.locator("footer").innerText()).includes("210.000"), "subtotal 50k+160k");
  // name is required
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByRole("alert").filter({ hasText: "Isi nama Anda" }).waitFor();
  await page.getByLabel("Nama Anda").fill("Siti");
  await page.getByLabel("Nomor WhatsApp").fill("081234567890");
  await page.getByLabel(/Catatan untuk penjual/).fill("Kirim sore ya");
  const wa = await sendAndOpenWhatsApp();
  assert(/Pesanan #[A-Z0-9]{6}/.test(wa) && wa.includes("Siti") && wa.includes("/order/"), wa);
  const code = wa.match(/Pesanan #([A-Z0-9]{6})/)[1];
  // returning from WhatsApp: the order is not lost or duplicated
  await page.goBack();
  let d = await db();
  assert.equal(d.orders.length, 1);
  assert.equal(d.orders[0].status, "pending");
  assert.equal(d.orders[0].subtotal, 210000);
  assert.equal(d.orders[0].note, "Kirim sore ya");
  assert.equal(d.orders[0].id.slice(0, 6).toUpperCase(), code);
  await page.getByText(`#${code}`).first().waitFor();
  await page.getByRole("link", { name: "Lacak status pesanan" }).click();
  await page.getByRole("heading", { name: "Penjual sedang memeriksa pesanan Anda" }).waitFor();
  const statusUrl = page.url();

  // ---------- owner confirms ----------
  await page.goto(`${B}/`);
  await page.getByRole("heading", { name: /Halo, Toko Melati/ }).waitFor();
  await page.getByRole("link", { name: "1 permintaan pesanan" }).waitFor();
  await page.goto(`${B}/orders`);
  await page.getByRole("heading", { name: "Pesanan masuk" }).waitFor();
  await page.getByText("Siti").first().waitFor();
  await page.getByRole("list", { name: "Daftar pesanan" }).getByRole("button").filter({ hasText: "Siti" }).first().click();
  await page.getByRole("link", { name: /Konfirmasi/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("heading", { name: new RegExp(`Konfirmasi pesanan #${code}`) }).waitFor();
  assert.equal(await dlg.getByLabel("Nama", { exact: true }).inputValue(), "Siti");
  await dlg.getByText(/Diisi dari/).waitFor();
  await dlg.getByLabel("DP / bayar sekarang").fill("100000");
  await dlg.getByRole("button", { name: "Konfirmasi pesanan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();
  d = await db();
  assert.equal(d.sales.length, 1);
  assert.equal(d.sales[0].channel, "catalog");
  assert.equal(d.sales[0].orderRequestId, d.orders[0].id);
  assert.equal(d.sales[0].total, 210000);
  assert.equal(d.sales[0].balance, 110000);
  assert.equal(d.orders[0].status, "confirmed");
  assert.equal(d.inventory.p1.stock, 4, "stock decremented by confirm");
  // pack + ship with tracking, mirrored publicly
  await page.getByRole("button", { name: /Tandai sudah dikemas/ }).click();
  await page.getByLabel("Kurir").fill("JNE");
  await page.getByLabel("Nomor resi").fill("JNE123");
  await page.getByRole("button", { name: /Tandai sudah dikirim/ }).click();
  await page.getByRole("button", { name: /Tandai selesai/ }).waitFor();
  d = await db();
  assert.equal(d.orders[0].progress, "shipped");
  assert.equal(d.orders[0].trackingNo, "JNE · JNE123");
  assert.equal(JSON.stringify(d.orders[0]).includes("deliveryNote"), false);
  // buyer sees it
  await page.goto(statusUrl);
  await page.getByRole("heading", { name: "Paket sedang menuju Anda" }).waitFor();
  await page.getByText("JNE123", { exact: true }).waitFor();
  await page.getByRole("region", { name: "Rincian pesanan" }).waitFor();

  // ---------- rejection never becomes a sale ----------
  await orderFromBuyer("Budi", "Voucher Game");
  await sendAndOpenWhatsApp();
  await page.goBack();
  await page.goto(`${B}/orders`);
  await page.getByText("Budi").first().waitFor();
  await page.getByRole("list", { name: "Daftar pesanan" }).getByRole("button").filter({ hasText: "Budi" }).first().click();
  await page.getByRole("button", { name: /^Tolak$/ }).click();
  await page.getByLabel("Alasan untuk pembeli (opsional)").fill("Stok habis");
  await page.getByRole("button", { name: "Tolak permintaan" }).click();
  await page.getByText(/ditolak/).first().waitFor();
  d = await db();
  const rejected = d.orders.find((o) => o.buyerName === "Budi");
  assert.equal(rejected.status, "rejected");
  assert.equal(d.sales.length, 1, "no sale for a rejected order");
  assert.equal(d.inventory.p1.stock, 4);
  await page.goto(`${B}/shop/tokomelati/order/${rejected.id}`);
  await page.getByRole("heading", { name: "Pesanan ini tidak bisa diproses" }).waitFor();
  await page.getByText("Alasan dari penjual").waitFor();
  await page.getByText("Stok habis", { exact: true }).waitFor();
  // confirming an already-processed order is refused
  await page.goto(`${B}/sales?confirm=${rejected.id}`);
  await page.getByText("sudah diproses atau tidak ditemukan").waitFor();

  // ---------- custom link ----------
  await page.goto(`${B}/catalog?store=edit`);
  await page.getByLabel("Tautan toko").fill("melati-shop");
  await page.getByText("Tautan ini tersedia.").waitFor();
  await page.getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").first().waitFor();
  await page.goto(`${B}/shop/melati-shop`);
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  await page.goto(`${B}/shop/u1`);
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  await page.goto(`${B}/shop/doesnotexist`);
  await page.getByRole("heading", { name: "Toko ini sedang tutup" }).waitFor();

  // ---------- layout ----------
  await page.goto(`${B}/`);
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  await page.waitForTimeout(300);
  const wide = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => !el.closest(".sr-only") && el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map((el) => el.tagName + "." + String(el.className).slice(0, 100) + " " + Math.round(el.getBoundingClientRect().right)));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "overflow home " + tag + "\n" + wide.join("\n"));
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/home-${tag}.png` });
  await page.goto(`${B}/shop/melati-shop`);
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "overflow shop " + tag);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/shop-${tag}.png` });
  const real = errors.filter((e) => !/favicon|DevTools|fonts\.g|ERR_FAILED|net::/.test(e));
  assert.deepEqual(real, [], "console errors: " + real.join("\n"));
  await ctx.close();
  console.log("PASS", tag);
}
test("Pesanan pembeli: katalog, keranjang, WhatsApp, konfirmasi dan tolak", async ({ browser }, info) => {
  if (info.project.name === "phone") await run(browser, { width: 390, height: 844 }, "mobile");
  else await run(browser, { width: 1280, height: 900 }, "desktop");
});
