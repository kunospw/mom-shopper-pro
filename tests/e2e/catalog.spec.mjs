import { test } from "@playwright/test";
import assert from "node:assert/strict";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
for (const [w, h, tag] of [[1440, 1000, "d"], [390, 844, "m"]]) {
  test(`Katalog dan editor produk · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const shot = (n) => shots && page.screenshot({ path: `${shots}/${n}-${tag}.png` });
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/catalog`);
    const list = page.getByRole("list", { name: "Daftar produk" });
    await list.waitFor();
    assert.equal(await list.getByRole("listitem").count(), 4);
    // stats + shop card
    await page.getByText("Tampil di toko").waitFor();
    await page.getByRole("button", { name: "Salin tautan", exact: true }).waitFor();
    assert.equal(await overflow(page), 0, "no page overflow");
    await shot("catalog");

    // filters + search (kept in URL)
    await page.getByRole("button", { name: /^Tersembunyi/ }).click();
    assert.equal(await list.getByRole("listitem").count(), 1);
    await list.getByText("Produk Draft").waitFor();
    await page.getByRole("button", { name: /^Preorder/ }).click();
    await list.getByText("Tas Rajut").waitFor();
    await page.getByRole("button", { name: /^Semua/ }).click();
    await page.getByLabel("Cari produk").fill("linen");
    assert.equal(await list.getByRole("listitem").count(), 1);
    assert.match(page.url(), /q=linen/);
    await page.getByLabel("Cari produk").fill("zzz");
    await page.getByText("Produk tidak ditemukan").waitFor();
    await page.getByRole("button", { name: "Tampilkan semua" }).click();
    await list.waitFor();

    // existing stock shows; show/hide switch
    await list.getByText("Stok 5").waitFor();
    await page.getByRole("switch", { name: "Tampilkan Produk Draft di katalog" }).click();
    await page.getByText("Produk Draft ditampilkan").waitFor();
    assert.equal(await page.evaluate(() => globalThis.__db.products.find((p) => p.id === "p4").published), true);

    // add product via the slide-over
    await page.getByRole("button", { name: "Tambah produk" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Tambah produk" });
    await sheet.waitFor();
    await sheet.getByLabel("Foto produk").setInputFiles(new URL("./fixtures/photo.png", import.meta.url).pathname);
    await sheet.getByRole("img", { name: "Foto produk yang dipilih" }).waitFor();
    await sheet.getByLabel("Nama produk").fill("Gamis Katun Rayon");
    await sheet.getByLabel(/Kategori/).fill("Pakaian");
    await sheet.getByLabel("Harga jual").fill("189000");
    assert.equal(await sheet.getByLabel("Harga jual").inputValue(), "189.000");
    await sheet.getByRole("button", { name: "Tambah pilihan" }).click();
    await sheet.getByRole("button", { name: "Ukuran", exact: true }).click();
    assert.equal(await sheet.getByLabel("Nama pilihan").inputValue(), "Ukuran");
    await sheet.getByLabel("Ukuran 1").fill("M");
    await sheet.getByRole("button", { name: "Tambah pilihan" }).click();
    await sheet.getByLabel("Ukuran 2").fill("XL");
    await sheet.locator("#opt-price-1").fill("199000");
    await sheet.getByRole("radio", { name: "Preorder" }).click();
    // preorder needs lead time
    await sheet.getByLabel("Modal per unit").fill("104000");
    await sheet.getByText("Untung per unit").waitFor();
    await sheet.getByText("Rp 85.000").waitFor();
    await sheet.getByRole("switch", { name: "Hitung stok otomatis" }).click();
    await sheet.getByRole("button", { name: "Simpan produk" }).click();
    await sheet.getByRole("alert").filter({ hasText: "estimasi waktu" }).waitFor();
    await sheet.getByLabel("Estimasi waktu preorder").fill("7–10 hari");
    await sheet.getByRole("button", { name: "Simpan produk" }).click();
    await sheet.getByRole("alert").filter({ hasText: "Isi stok saat ini" }).waitFor();
    await sheet.getByPlaceholder("Stok saat ini").fill("2");
    await sheet.getByRole("switch", { name: "Tampilkan di katalog" }).click();
    // preview reflects the price range and PO badge
    await sheet.getByText("Rp 189.000 – 199.000").waitFor();
    await sheet.getByText("PO 7–10 hari").first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await shot("product-editor");
    await sheet.getByRole("button", { name: "Simpan produk" }).click();
    await page.getByText("Produk disimpan").waitFor();
    const db = await page.evaluate(() => globalThis.__db);
    const made = db.products.find((p) => p.name === "Gamis Katun Rayon");
    assert.equal(made.price, 189000);
    assert.deepEqual(made.options, [{ label: "M", price: 0 }, { label: "XL", price: 199000 }]);
    assert.equal(made.optionLabel, "Ukuran");
    assert.equal(made.availability, "preorder");
    assert.equal(made.leadTime, "7–10 hari");
    assert.equal(made.published, true);
    assert.ok(made.image.startsWith("data:image/"));
    assert.deepEqual(db.inventory[made.id], { cost: 104000, stock: 2 });
    await list.getByText("Stok tinggal 2").waitFor();
    await list.getByText("Untung Rp 85.000/unit").waitFor();
    await page.getByRole("button", { name: /^Stok menipis/ }).click();
    await list.getByText("Gamis Katun Rayon").waitFor();
    await page.getByRole("button", { name: /^Semua/ }).click();

    // edit keeps values, then delete with confirmation
    await page.getByRole("button", { name: "Edit Gamis Katun Rayon" }).click();
    const edit = page.getByRole("dialog", { name: "Edit produk" });
    assert.equal(await edit.getByLabel("Harga jual").inputValue(), "189.000");
    assert.equal(await edit.getByLabel("Modal per unit").inputValue(), "104.000");
    await edit.getByRole("button", { name: "Batal" }).click();
    await page.getByRole("button", { name: "Hapus Gamis Katun Rayon" }).click();
    await page.getByRole("alertdialog", { name: "Hapus Gamis Katun Rayon?" }).getByRole("button", { name: "Hapus produk" }).click();
    await page.getByText("Produk dihapus").waitFor();
    await page.getByRole("alertdialog").waitFor({ state: "detached" });
    assert.equal(await list.getByRole("listitem").count(), 4);

    // empty catalog
    await page.evaluate(() => { globalThis.__db.products = []; localStorage.setItem("__mockdb_v1", JSON.stringify(globalThis.__db)); });
    await page.reload();
    await page.getByText("Belum ada produk").waitFor();
    await page.getByRole("button", { name: "Tambah produk pertama" }).click();
    await page.getByRole("dialog", { name: "Tambah produk" }).waitFor();
    await page.keyboard.press("Escape");
    await shot("catalog-empty");
    assert.deepEqual(errors, []);
    console.log(`PASS catalog ${tag}`);
    await ctx.close();
  });
}
