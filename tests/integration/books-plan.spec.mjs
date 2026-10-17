import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { accounts, getDoc, listDocs, patchDoc, PROJECT_ID, resetEmulators } from "./support/emulator.mjs";
import { buyerOrders, buyerPage, ownerWithShop, prepare, signIn, signOut } from "./support/app.mjs";

test.beforeEach(resetEmulators);
const rp = (t) => (/−|-/.test(t) ? -1 : 1) * Number(t.replace(/[^\d]/g, ""));
const DAY = 86_400_000;

test("purchase raises stock, expense recorded, Laporan adds up from real data", async ({ page, browser, baseURL }) => {
  const errors = await prepare(page);
  await ownerWithShop(page);
  const uid = (await accounts())["dewi@example.com"];
  const sambal = (await listDocs(`storefronts/${uid}/products`)).find((p) => p.name === "Sambal Roa");

  // a sale from a confirmed buyer order: revenue 125.000, cost of goods 78.000
  const buyer = await buyerPage(browser, baseURL);
  const orderId = await buyerOrders(buyer.page, "dapur-dewi", { buyer: "Siti", items: [{ product: "Sambal Roa" }, { product: "Kaos Polos", option: "M" }] });
  await buyer.close();
  await page.goto(`/sales?confirm=${orderId}`);
  await page.getByRole("dialog").getByRole("button", { name: "Konfirmasi pesanan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();

  // 6. a purchase linked to the product raises its stock (9 + 5)
  await page.goto("/costs?new=purchase");
  const sheet = page.getByRole("dialog", { name: "Catat pembelian stok" });
  await sheet.getByLabel("Nama barang").fill("Sambal Roa");
  await sheet.getByLabel("Jumlah", { exact: true }).fill("5");
  await sheet.getByLabel("Harga beli satuan").fill("27000");
  await sheet.getByLabel("Tambah ke stok produk").selectOption(sambal.id);
  await sheet.getByLabel("Ongkir pembelian").fill("10000");
  await sheet.getByRole("button", { name: "Simpan pembelian" }).click();
  await page.getByText("Pembelian tersimpan").waitFor();
  const [purchase] = await listDocs(`users/${uid}/purchases`);
  assert.equal(purchase.shipping, 10000);
  assert.equal(purchase.items[0].quantity, 5);
  assert.equal((await getDoc(`users/${uid}/inventory/${sambal.id}`)).stock, 14);

  // a business expense
  await page.goto("/costs?new=expense");
  const ex = page.getByRole("dialog", { name: "Catat biaya usaha" });
  await ex.getByRole("radio", { name: "Kemasan" }).click();
  await ex.getByLabel("Jumlah biaya").fill("35000");
  await ex.getByRole("button", { name: "Simpan biaya" }).click();
  await page.getByText("Biaya tersimpan").waitFor();
  const [expense] = await listDocs(`users/${uid}/expenses`);
  assert.equal(expense.amount, 35000);

  // Laporan: 125.000 − 78.000 = 47.000 gross; − 35.000 − 10.000 = 2.000 net
  await page.goto("/reports");
  await page.getByRole("heading", { name: "Rincian keuntungan" }).waitFor();
  const rows = await page.locator("dl").filter({ hasText: "Laba kotor" }).locator("> div").evaluateAll((els) => els.map((e) => [e.querySelector("dt > span").textContent.replace(/^[−=]\s*/, "").trim(), e.querySelector("dd").innerText]));
  const v = Object.fromEntries(rows);
  assert.equal(rp(v["Penjualan"]), 125000, JSON.stringify(v));
  assert.equal(Math.abs(rp(v["Modal barang terjual"])), 78000);
  assert.equal(rp(v["Laba kotor"]), 47000);
  assert.equal(Math.abs(rp(v["Biaya usaha"])), 35000);
  assert.equal(Math.abs(rp(v["Ongkir pembelian"])), 10000);
  assert.equal(rp(v["Keuntungan bersih"]), 2000);
  // Beranda shows the same net profit
  await page.goto("/");
  await page.getByText("Rp 2.000").first().waitFor();
  assert.deepEqual(errors, []);
});

test("trial ends: shop closes, new orders denied, tracking and books keep working; paidUntil reopens", async ({ page, browser, baseURL }) => {
  const errors = await prepare(page);
  await ownerWithShop(page);
  const uid = (await accounts())["dewi@example.com"];
  const buyer = await buyerPage(browser, baseURL);
  const orderId = await buyerOrders(buyer.page, "dapur-dewi", { buyer: "Siti", items: [{ product: "Sambal Roa" }] });
  const statusUrl = buyer.page.url();

  // 7. time travel: the trial started 8 days ago
  await patchDoc(`entitlements/${uid}`, { trialStartedAt: new Date(Date.now() - 8 * DAY) });
  await page.goto("/");
  await page.getByRole("status").filter({ hasText: "Masa uji coba berakhir" }).first().waitFor();
  // the rules hide the products, so the buyer sees a closed shop
  await buyer.page.goto("/shop/dapur-dewi");
  await buyer.page.getByRole("heading", { name: "Toko ini sedang tutup" }).waitFor();
  // a new order straight to Firestore is refused by the rules
  const denied = await fetch(`http://127.0.0.1:8088/v1/projects/${PROJECT_ID}/databases/(default)/documents/storefronts/${uid}/orders`, { method: "POST", body: "{}" });
  assert.equal(denied.status, 403, "order create denied without access");
  // the existing order is still trackable
  await buyer.page.goto(statusUrl);
  await buyer.page.getByRole("heading", { name: "Penjual sedang memeriksa pesanan Anda" }).waitFor();
  // and the owner can still confirm it and keep the books
  await page.goto(`/sales?confirm=${orderId}`);
  await page.getByRole("dialog").getByRole("button", { name: "Konfirmasi pesanan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();
  assert.equal((await getDoc(`storefronts/${uid}/orders/${orderId}`)).status, "confirmed");

  // the operator records the payment; "Saya sudah bayar" reopens the shop
  await page.goto("/");
  await page.getByRole("button", { name: "Lihat paket" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Saya sudah bayar/ }).click();
  await dialog.getByText(/Belum aktif/).waitFor();
  await patchDoc(`entitlements/${uid}`, { paidUntil: new Date(Date.now() + 30 * DAY) });
  await dialog.getByRole("button", { name: /Saya sudah bayar/ }).click();
  await dialog.getByText("Paket aktif. Terima kasih!").waitFor();
  await buyer.page.goto("/shop/dapur-dewi");
  await buyer.page.getByRole("button", { name: /^Lihat Sambal Roa/ }).waitFor();
  assert.deepEqual(buyer.errors.filter((e) => !/permission|Missing or insufficient/i.test(e)), []);
  await buyer.close();
  assert.deepEqual(errors, []);
});

test("owners are isolated; settings persist across reloads and sign-ins", async ({ page }) => {
  const errors = await prepare(page);
  await ownerWithShop(page);
  const dewi = (await accounts())["dewi@example.com"];

  // 9. settings persist in Firestore
  await page.goto("/settings/business");
  await page.getByLabel("Nama bisnis").fill("Dapur Dewi Jaya");
  await page.getByRole("radio", { name: /Biru/ }).click();
  await page.getByRole("button", { name: "Simpan bisnis" }).click();
  await page.getByText("Profil berhasil diperbarui").first().waitFor();
  await page.goto("/settings/payments");
  await page.getByRole("button", { name: "Tambah rekening" }).click();
  await page.getByLabel("Nama bank").last().fill("Mandiri");
  await page.getByLabel("Nomor rekening").last().fill("9988776655");
  await page.getByLabel("Nama pemilik rekening").last().fill("Dewi");
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  await page.getByText("Profil berhasil diperbarui").first().waitFor();
  const profile = await getDoc(`users/${dewi}`);
  assert.equal(profile.businessName, "Dapur Dewi Jaya");
  assert.equal(profile.businessAccent, "blue");
  assert.ok(profile.bankAccounts.some((b) => b.bankName === "Mandiri" && b.accountNumber === "9988776655"));
  await page.reload();
  await page.getByRole("heading", { name: "Rekening bank" }).waitFor();
  assert.equal(await page.getByLabel("Nomor rekening").last().inputValue(), "9988776655");
  await page.goto("/settings/business");
  assert.equal(await page.getByLabel("Nama bisnis").inputValue(), "Dapur Dewi Jaya");

  // 8. a second owner sees none of Dewi's data
  await signOut(page);
  await signIn(page, { name: "Rani", email: "rani@example.com" });
  const rani = (await accounts())["rani@example.com"];
  assert.notEqual(rani, dewi);
  await page.goto("/catalog");
  await page.getByText("Siapkan toko Anda").waitFor();
  await page.goto("/sales");
  await page.getByText(/Belum ada penjualan/).first().waitFor();
  // and Firestore itself refuses cross-owner reads with Rani's token
  const token = await page.evaluate(() => globalThis.__emulatorIdToken());
  assert.ok(token);
  {
    const base = `http://127.0.0.1:8088/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
    for (const path of [`users/${dewi}`, `users/${dewi}/inventory`, `entitlements/${dewi}`, `storefronts/${dewi}/orders`]) {
      const res = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 403, `Rani reading ${path}`);
    }
  }
  // signed out (a buyer) cannot list any owner's orders
  const anon = await fetch(`http://127.0.0.1:8088/v1/projects/${PROJECT_ID}/databases/(default)/documents/storefronts/${dewi}/orders`);
  assert.equal(anon.status, 403);
  // Dewi's data is still there when she signs back in
  await signOut(page);
  await signIn(page, { name: "Dewi Lestari", email: "dewi@example.com" });
  await page.goto("/settings/business");
  assert.equal(await page.getByLabel("Nama bisnis").inputValue(), "Dapur Dewi Jaya");
  await page.goto("/catalog");
  await page.getByRole("list", { name: "Daftar produk" }).getByText("Sambal Roa").waitFor();
  assert.deepEqual(errors, []);
});
