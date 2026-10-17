import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { accounts, getDoc, listDocs, resetEmulators } from "./support/emulator.mjs";
import { buyerOrders, buyerPage, ownerWithShop, prepare } from "./support/app.mjs";

test.beforeEach(resetEmulators);

test("buyer order → live alert → confirm with DP → paid, refund, shipped; rejected order shows its reason", async ({ page, browser, baseURL }) => {
  const errors = await prepare(page);
  await ownerWithShop(page);
  const uid = (await accounts())["dewi@example.com"];
  const products = await listDocs(`storefronts/${uid}/products`);
  const sambal = products.find((p) => p.name === "Sambal Roa");
  const kaos = products.find((p) => p.name === "Kaos Polos");

  // owner waits on Beranda; nothing pending yet
  await page.goto("/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  await page.waitForTimeout(1500);

  // 4. a signed-out buyer orders from the public shop
  const buyer = await buyerPage(browser, baseURL);
  const orderId = await buyerOrders(buyer.page, "dapur-dewi", { buyer: "Siti", items: [{ product: "Sambal Roa" }, { product: "Kaos Polos", option: "L" }], note: "Kirim sore" });
  await buyer.page.getByRole("heading", { name: "Penjual sedang memeriksa pesanan Anda" }).waitFor();
  const statusUrl = buyer.page.url();
  let order = await getDoc(`storefronts/${uid}/orders/${orderId}`);
  assert.equal(order.status, "pending");
  assert.equal(order.buyerName, "Siti");
  assert.equal(order.note, "Kirim sore");
  assert.equal(order.subtotal, 125000);
  assert.deepEqual(order.shop, { name: "Dapur Dewi", whatsapp: "6281211112222", slug: "dapur-dewi" }, "shop snapshot");
  assert.deepEqual(order.items.map((i) => [i.name, i.option, i.quantity, i.unitPrice]), [["Sambal Roa", "", 1, 45000], ["Kaos Polos", "L", 1, 80000]]);

  // 5. the owner's open Beranda announces it live (Firestore listener)
  await page.getByText("Pesanan baru dari Siti").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Lihat" }).first().click();
  await page.waitForURL(/\/orders\?id=/);
  await page.getByRole("link", { name: /Konfirmasi/ }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByLabel("DP / bayar sekarang").fill("50000");
  await confirm.getByRole("button", { name: "Konfirmasi pesanan" }).click();
  await page.getByRole("heading", { name: /INV-\d{4}-001 · Siti/ }).waitFor();

  let [sale] = await listDocs(`users/${uid}/sales`);
  assert.equal(sale.channel, "catalog");
  assert.equal(sale.orderRequestId, orderId);
  assert.equal(sale.total, 125000);
  assert.equal(sale.payments.length, 1);
  assert.equal(sale.payments[0].amount, 50000);
  order = await getDoc(`storefronts/${uid}/orders/${orderId}`);
  assert.equal(order.status, "confirmed");
  assert.ok(order.steps.confirmed instanceof Date, "confirm time stamped by the server");
  assert.equal((await getDoc(`users/${uid}/inventory/${sambal.id}`)).stock, 9, "stock moved on confirm");
  assert.equal((await getDoc(`users/${uid}/inventory/${kaos.id}`)).stock, 5);
  await buyer.page.goto(statusUrl);
  await buyer.page.getByRole("heading", { name: "Pesanan dikonfirmasi penjual" }).waitFor();

  // the rest of the payment → lunas
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Tambah pembayaran" }).click();
  await detail.getByRole("button", { name: /Isi sisa tagihan/ }).click();
  await detail.getByRole("button", { name: "Simpan", exact: true }).click();
  await detail.getByText("Lunas").first().waitFor();
  [sale] = await listDocs(`users/${uid}/sales`);
  assert.deepEqual(sale.payments.map((p) => p.amount), [50000, 75000]);
  // a partial refund (return) is stored as its own entry
  await detail.getByRole("button", { name: "Catat pengembalian dana" }).click();
  await detail.getByLabel("Jumlah dikembalikan").fill("25000");
  await detail.getByRole("button", { name: "Simpan", exact: true }).click();
  await detail.getByText(/Pengembalian dana/).first().waitFor();
  [sale] = await listDocs(`users/${uid}/sales`);
  const refund = sale.payments.find((p) => p.kind === "refund");
  assert.equal(refund.amount, 25000);
  assert.equal(refund.reason, "return");

  // pack and ship with a tracking number; the buyer's page follows
  await detail.getByRole("button", { name: /Tandai sudah dikemas/ }).click();
  await detail.getByLabel("Kurir").fill("JNE");
  await detail.getByLabel("Nomor resi").fill("JNE123");
  await detail.getByRole("button", { name: /Tandai sudah dikirim/ }).click();
  await detail.getByRole("button", { name: /Tandai selesai/ }).waitFor();
  order = await getDoc(`storefronts/${uid}/orders/${orderId}`);
  assert.equal(order.progress, "shipped");
  assert.equal(order.trackingNo, "JNE · JNE123");
  assert.ok(order.steps.shipped instanceof Date);
  await buyer.page.goto(statusUrl);
  await buyer.page.getByRole("heading", { name: "Paket sedang menuju Anda" }).waitFor();
  await buyer.page.getByText("JNE123", { exact: true }).waitFor();

  // a second order is rejected with a reason the buyer sees; stock untouched
  const second = await buyerOrders(buyer.page, "dapur-dewi", { buyer: "Budi", items: [{ product: "Sambal Roa" }] });
  await page.goto(`/orders?id=${second}`);
  await page.getByText("Budi").first().waitFor();
  await page.getByRole("button", { name: /^Tolak$/ }).click();
  await page.getByLabel("Alasan untuk pembeli (opsional)").fill("Stok habis");
  await page.getByRole("button", { name: "Tolak permintaan" }).click();
  await page.getByText(/ditolak/).first().waitFor();
  const rejected = await getDoc(`storefronts/${uid}/orders/${second}`);
  assert.equal(rejected.status, "rejected");
  assert.equal((await listDocs(`users/${uid}/sales`)).length, 1, "no sale for a rejected order");
  assert.equal((await getDoc(`users/${uid}/inventory/${sambal.id}`)).stock, 9);
  await buyer.page.goto(`/shop/dapur-dewi/order/${second}`);
  await buyer.page.getByRole("heading", { name: "Pesanan ini tidak bisa diproses" }).waitFor();
  await buyer.page.getByText("Stok habis", { exact: true }).waitFor();

  assert.deepEqual(buyer.errors, []);
  await buyer.close();
  assert.deepEqual(errors, []);
});
