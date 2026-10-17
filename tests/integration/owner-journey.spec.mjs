import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { accounts, getDoc, listDocs, resetEmulators } from "./support/emulator.mjs";
import { addProduct, openShop, prepare, signIn } from "./support/app.mjs";

test.beforeEach(resetEmulators);

test("sign in, open the shop, add products: real documents and rules", async ({ page }) => {
  const errors = await prepare(page);
  // 1. Google sign-in through the emulator popup creates the profile
  await signIn(page, { name: "Dewi Lestari", email: "dewi@example.com" });
  const uid = (await accounts())["dewi@example.com"];
  assert.ok(uid, "account created in the Auth emulator");
  const profile = await getDoc(`users/${uid}`);
  assert.equal(profile.email, "dewi@example.com");
  assert.equal(profile.displayName, "Dewi Lestari");
  assert.equal(profile.businessAccent, "forest", "new accounts start on the platform accent");
  await page.getByText("Belum ada transaksi. Catat penjualan pertama Anda.").waitFor();

  // 2. guided setup writes storefront, slug and the trial in one batch
  await openShop(page, { name: "Dapur Dewi", whatsapp: "0812 1111 2222" });
  const store = await getDoc(`storefronts/${uid}`);
  assert.equal(store.name, "Dapur Dewi");
  assert.equal(store.slug, "dapur-dewi");
  assert.equal(store.whatsapp, "6281211112222");
  assert.equal(store.published, true);
  assert.deepEqual(await getDoc("slugs/dapur-dewi"), { id: "dapur-dewi", storeId: uid });
  const ent = await getDoc(`entitlements/${uid}`);
  assert.ok(ent.trialStartedAt instanceof Date, "server timestamp");
  assert.ok(Math.abs(ent.trialStartedAt.getTime() - Date.now()) < 120_000, "trial starts now (server time)");
  assert.equal(ent.paidUntil, null);
  await page.goto("/settings/plan");
  await page.getByText(/sisa 7 hari/).first().waitFor();

  // 3. products with photo, options, cost and stock
  await addProduct(page, { name: "Sambal Roa", price: 45000, cost: 28000, stock: 10 });
  await addProduct(page, { name: "Kaos Polos", price: 80000, cost: 50000, stock: 6, options: ["M", "L"] });
  const products = await listDocs(`storefronts/${uid}/products`);
  assert.equal(products.length, 2);
  const sambal = products.find((p) => p.name === "Sambal Roa");
  assert.equal(sambal.price, 45000);
  assert.equal(sambal.published, true);
  assert.ok(sambal.image.startsWith("data:image/"), "photo stored inline (no Firebase Storage)");
  assert.ok(sambal.image.length < 300_000, "photo compressed");
  assert.equal(JSON.stringify(sambal).includes("28000"), false, "cost never on the public product");
  const inventory = await getDoc(`users/${uid}/inventory/${sambal.id}`);
  assert.equal(inventory.cost, 28000);
  assert.equal(inventory.stock, 10);
  const kaos = products.find((p) => p.name === "Kaos Polos");
  assert.deepEqual(kaos.options.map((o) => o.label), ["M", "L"]);

  // bulk add from a CSV writes several products (and their stock) at once
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Tambah banyak" }).click();
  const bulk = page.getByRole("dialog", { name: "Tambah banyak produk" });
  await bulk.getByLabel("Pilih file CSV").setInputFiles(new URL("../e2e/fixtures/produk.csv", import.meta.url).pathname);
  const rows = bulk.getByRole("list", { name: "Produk yang akan ditambahkan" });
  await rows.getByRole("listitem").nth(1).getByLabel("Harga").fill("60000");
  await rows.getByRole("listitem").nth(2).getByLabel("Status").selectOption("preorder");
  await bulk.getByText("semua lengkap").waitFor();
  await bulk.getByRole("button", { name: "Simpan 3 produk" }).click();
  await page.getByText("3 produk ditambahkan").last().waitFor();
  const after = await listDocs(`storefronts/${uid}/products`);
  assert.equal(after.length, 5);
  const flanel = after.find((p) => p.name === "Kemeja Flanel");
  assert.equal(flanel.price, 135000);
  assert.deepEqual(flanel.options.map((o) => o.label), ["S", "M", "L"]);
  const flanelStock = await getDoc(`users/${uid}/inventory/${flanel.id}`);
  assert.equal(flanelStock.cost, 80000);
  assert.equal(flanelStock.stock, 10);
  assert.equal(after.find((p) => p.name === "Syal").availability, "preorder");

  // the public shop shows them to a signed-out buyer
  const buyer = await page.context().browser().newPage();
  await prepare(buyer);
  await buyer.goto(new URL("/shop/dapur-dewi", page.url()).href);
  await buyer.getByRole("heading", { name: "Dapur Dewi" }).waitFor();
  await buyer.getByRole("button", { name: /^Lihat Sambal Roa/ }).waitFor();
  await buyer.close();
  assert.deepEqual(errors, []);
});
