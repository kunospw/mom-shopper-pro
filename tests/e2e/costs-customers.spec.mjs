import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
for (const [w, h, tag] of [[1440, 1000, "d"], [390, 844, "m"]]) {
  test(`Pembelian & biaya, Pelanggan · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "wa" }));
    const shot = (n) => shots && page.screenshot({ path: `${shots}/${n}-${tag}.png` });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await page.waitForTimeout(500);

    // ---- Pembelian & biaya ----
    await page.goto(`${B}/costs`);
    const list = page.getByRole("list", { name: "Catatan pembelian dan biaya" });
    await list.waitFor();
    await page.getByText("Belanja stok bulan ini").waitFor();
    const before = await list.getByRole("listitem").count();
    assert.ok(before >= 12, `seeded rows ${before}`);
    assert.equal(await overflow(), 0);
    await shot("costs");
    await page.getByRole("button", { name: /^Biaya usaha/ }).click();
    assert.equal(await list.getByRole("listitem").count(), 6);
    await page.getByRole("button", { name: /^Semua/ }).click();

    // purchase with two lines linked to stock
    await page.getByRole("button", { name: "Catat pembelian" }).click();
    const sheet = page.getByRole("dialog", { name: "Catat pembelian stok" });
    await sheet.getByLabel("Nama barang").fill("Kemeja Linen");
    await sheet.getByLabel("Jumlah", { exact: true }).fill("4");
    await sheet.getByLabel("Harga beli satuan").fill("90000");
    await sheet.getByLabel("Tambah ke stok produk").selectOption("p1");
    await sheet.getByRole("button", { name: "Tambah barang" }).click();
    await sheet.getByLabel("Nama barang 2").fill("Plastik kemasan");
    await sheet.getByLabel("Harga beli satuan").nth(1).fill("500");
    await sheet.getByLabel("Ongkir pembelian").fill("15000");
    await sheet.getByLabel(/Pemasok/).fill("CV Linen Asri");
    await sheet.getByText("Rp 375.500").waitFor();
    assert.equal(await overflow(), 0);
    await shot("purchase-form");
    await sheet.getByRole("button", { name: "Simpan pembelian" }).click();
    await page.getByText("Pembelian tersimpan").waitFor();
    let db = await page.evaluate(() => globalThis.__db);
    let p = db.purchases.find((x) => x.supplier === "CV Linen Asri");
    assert.deepEqual(p.items, [{ productId: "p1", name: "Kemeja Linen", quantity: 4, unitCost: 90000 }, { name: "Plastik kemasan", quantity: 1, unitCost: 500 }]);
    assert.equal(p.total, 375500);
    assert.equal(db.inventory.p1.stock, 9, "stock 5 + 4");

    // edit it (quantity 4 -> 2) adjusts stock
    await list.getByRole("button", { name: /^Kemeja Linen ×4/ }).click();
    const editSheet = page.getByRole("dialog", { name: "Ubah pembelian stok" });
    await editSheet.getByLabel("Jumlah", { exact: true }).first().fill("2");
    await editSheet.getByRole("button", { name: "Simpan pembelian" }).click();
    await page.getByText("Pembelian diperbarui").waitFor();
    db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.inventory.p1.stock, 7, "edit moves stock by the difference");

    // validation
    await page.getByRole("button", { name: "Catat pembelian" }).click();
    await sheet.getByRole("button", { name: "Simpan pembelian" }).click();
    await sheet.getByRole("alert").filter({ hasText: "Isi nama barang" }).waitFor();
    await sheet.getByRole("button", { name: "Batal" }).click();
    await sheet.waitFor({ state: "detached" });

    // expense via ?new=expense with category tiles
    await page.goto(`${B}/costs?new=expense`);
    const ex = page.getByRole("dialog", { name: "Catat biaya usaha" });
    await ex.getByRole("radio", { name: "Kemasan" }).click();
    await ex.getByLabel("Jumlah biaya").fill("35000");
    await ex.getByLabel(/Catatan/).fill("Bubble wrap");
    await shot("expense-form");
    await ex.getByRole("button", { name: "Simpan biaya" }).click();
    await page.getByText("Biaya tersimpan").waitFor();
    db = await page.evaluate(() => globalThis.__db);
    assert.ok(db.expenses.some((e) => e.category === "packaging" && e.amount === 35000 && e.note === "Bubble wrap"));
    await page.getByText("Biaya usaha bulan ini").waitFor();
    await page.getByRole("img", { name: /Kemasan \d+% dari biaya usaha/ }).waitFor();

    // delete asks first; purchase delete returns stock
    await page.getByRole("button", { name: /Hapus pembelian Kemeja Linen ×2/ }).click();
    await page.getByRole("alertdialog").getByText("Stok produk yang dikaitkan ikut dikurangi kembali.").waitFor();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus" }).click();
    await page.getByText("Pembelian dihapus").waitFor();
    db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.inventory.p1.stock, 5);

    // ---- Pelanggan ----
    await page.goto(`${B}/customers`);
    await page.getByText("Langganan", { exact: true }).first().waitFor();
    assert.equal(await overflow(), 0);
    await shot("customers");
    await page.getByRole("button", { name: /^Belum lunas/ }).click();
    const owing = tag === "d" ? page.locator("tbody tr") : page.locator("main ul li");
    const owingCount = await owing.count();
    assert.ok(owingCount >= 1 && owingCount < 7, `owing ${owingCount}`);
    await page.getByRole("button", { name: /^Semua/ }).click();
    await page.getByRole("searchbox", { name: "Cari pelanggan" }).fill("ayu");
    await page.getByRole("link", { name: "Ayu Lestari" }).first().click();
    const detail = page.getByRole("dialog", { name: "Ayu Lestari" });
    await detail.getByRole("heading", { name: "Riwayat belanja" }).waitFor();
    const tagih = detail.getByRole("link", { name: "Tagih via WhatsApp" });
    assert.match(await tagih.getAttribute("href"), /^https:\/\/wa\.me\/6281277889911\?text=/);
    await detail.getByText("+62 812-7788-9911").waitFor();
    await shot("customer-detail");
    await detail.getByRole("button", { name: "Ubah" }).click();
    const form = page.getByRole("dialog", { name: "Ubah pelanggan" });
    await form.getByLabel("WhatsApp").fill("0812 1111 2222");
    await form.getByRole("button", { name: "Simpan pelanggan" }).click();
    await page.getByText("Pelanggan tersimpan").waitFor();
    db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.customers.find((c) => c.name === "Ayu Lestari").whatsapp, "6281211112222", "08 normalized");
    // history links to the sale
    await detail.getByRole("link", { name: /INV/ }).first().click();
    await page.waitForURL(/\/sales\?view=/);

    // new customer: bad number rejected
    await page.goto(`${B}/customers`);
    await page.getByRole("button", { name: "Tambah pelanggan" }).click();
    const add = page.getByRole("dialog", { name: "Tambah pelanggan" });
    await add.getByLabel("Nama").fill("Nur");
    await add.getByLabel("WhatsApp").fill("0812");
    await add.getByRole("button", { name: "Simpan pelanggan" }).click();
    await add.getByRole("alert").filter({ hasText: "belum lengkap" }).waitFor();
    await add.getByLabel("WhatsApp").fill("");
    await add.getByRole("button", { name: "Simpan pelanggan" }).click();
    await page.getByText("Pelanggan tersimpan").waitFor();

    assert.deepEqual(errors, []);
    console.log(`PASS costs + customers ${tag}`);
    await ctx.close();
  });
}
