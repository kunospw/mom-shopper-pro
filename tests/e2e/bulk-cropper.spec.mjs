import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const B = "http://localhost:8099";
const F = (n) => decodeURIComponent(new URL(`./fixtures/${n}`, import.meta.url).pathname);
const shots = process.env.E2E_SHOTS;
// Size of a data URL image, measured in the page.
const dims = (page, src) => page.evaluate((s) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = s; }), src);
const pixel = (page, src) => page.evaluate((s) => new Promise((r) => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext("2d"); x.drawImage(i, 0, 0); r([...x.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data].slice(0, 3)); }; i.src = s; }), src);

for (const [w, h, tag] of [[1440, 1000, "d"], [390, 844, "m"]]) {
  test(`Tambah banyak produk dan potong foto · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const shot = async (n) => { if (!shots) return; await page.waitForTimeout(600); await page.screenshot({ path: `${shots}/${n}-${tag}.png` }); };
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/catalog`);
    await page.getByRole("list", { name: "Daftar produk" }).waitFor();
    const before = await page.evaluate(() => globalThis.__db.products.length);

    // ---- photo cropper in the single product editor ----
    await page.getByRole("button", { name: "Tambah produk", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Tambah produk" });
    await sheet.getByLabel("Foto produk").setInputFiles(F("landscape.png"));
    const photo = sheet.getByRole("img", { name: "Foto produk yang dipilih" });
    await photo.waitFor();
    const auto = await photo.getAttribute("src");
    const [aw, ah] = await dims(page, auto);
    assert.equal(aw, ah, "auto crop is square");
    assert.equal(aw, 600, "landscape 1200x600 -> 600 square");
    await sheet.getByRole("button", { name: "Sesuaikan foto" }).click();
    const cropper = page.getByRole("dialog", { name: "Sesuaikan foto" });
    const area = cropper.getByRole("application");
    await area.waitFor();
    await page.waitForTimeout(300);
    await shot("cropper");
    // drag to the right reveals the left (red) half
    const box = await area.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await area.focus();
    await page.keyboard.press("+");
    await cropper.getByRole("button", { name: "Pakai foto" }).click();
    await cropper.waitFor({ state: "detached" });
    const adjusted = await photo.getAttribute("src");
    assert.notEqual(adjusted, auto, "crop changed");
    const [r, , b] = await pixel(page, adjusted);
    assert.ok(r > 150 && b < 120, `center is now red: ${r},${b}`);
    assert.deepEqual(await dims(page, adjusted).then(([x, y]) => x === y), true);
    await sheet.getByRole("button", { name: "Batal" }).click();
    await page.getByRole("button", { name: /Buang|Tinggalkan|Keluar/ }).click().catch(() => {});
    await sheet.waitFor({ state: "detached" });

    // ---- bulk: from photos ----
    await page.getByRole("button", { name: "Tambah banyak" }).click();
    const bulk = page.getByRole("dialog", { name: "Tambah banyak produk" });
    await bulk.getByRole("heading", { name: "Dari foto" }).waitFor();
    assert.equal(await overflow(), 0);
    await shot("bulk-start");
    await bulk.getByLabel("Pilih foto produk").setInputFiles([F("gamis-katun_rayon.png"), F("IMG_20240101_1234.png"), F("hijab mocca.png")]);
    const list = bulk.getByRole("list", { name: "Produk yang akan ditambahkan" });
    await list.waitFor();
    assert.equal(await list.getByRole("listitem").count(), 3);
    assert.equal(await bulk.getByLabel("Nama produk 1").inputValue(), "Gamis Katun Rayon");
    assert.equal(await bulk.getByLabel("Nama produk 2").inputValue(), "", "camera file name not used");
    assert.equal(await bulk.getByLabel("Nama produk 3").inputValue(), "Hijab Mocca");
    await bulk.getByText("3 perlu dilengkapi").waitFor();
    assert.equal(await bulk.getByRole("button", { name: /Simpan 0 yang lengkap/ }).isDisabled(), true);
    await list.getByRole("listitem").nth(0).getByLabel("Harga").fill("189000");
    await list.getByRole("listitem").nth(0).getByLabel("Kategori").fill("Pakaian");
    await list.getByRole("listitem").nth(0).getByLabel("Stok").fill("5");
    await list.getByRole("listitem").nth(2).getByLabel("Harga").fill("45000");
    await bulk.getByText("Nama produk kosong.").waitFor();
    assert.equal(await overflow(), 0);
    await shot("bulk-review");
    // save the two complete rows; the incomplete one stays
    await bulk.getByRole("button", { name: "Simpan 2 yang lengkap" }).click();
    await bulk.getByText(/2 produk tersimpan\. 1 baris/).waitFor();
    assert.equal(await list.getByRole("listitem").count(), 1);
    let db = await page.evaluate(() => globalThis.__db);
    const gamis = db.products.find((p) => p.name === "Gamis Katun Rayon");
    assert.ok(gamis && gamis.price === 189000 && gamis.category === "Pakaian" && gamis.published === true);
    const [gw, gh] = await dims(page, gamis.image);
    assert.equal(gw, gh, "portrait photo cropped square");
    assert.deepEqual(db.inventory[gamis.id], { cost: 0, stock: 5 });
    assert.equal(db.products.find((p) => p.name === "Hijab Mocca").price, 45000);
    // finish the last row
    await bulk.getByLabel("Nama produk 1").fill("Mukena Travel");
    await bulk.getByLabel("Harga").fill("165000");
    await bulk.getByRole("button", { name: "Simpan 1 produk" }).click();
    await page.getByText("3 produk ditambahkan").last().waitFor();
    await bulk.waitFor({ state: "detached" });
    db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.products.length, before + 3);

    // ---- bulk: CSV file with errors, template, xlsx hint, paste ----
    await page.getByRole("button", { name: "Tambah banyak" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), bulk.getByRole("button", { name: "Unduh template" }).click()]);
    assert.equal(download.suggestedFilename(), "template-produk.csv");
    const template = readFileSync(await download.path(), "utf8");
    assert.match(template, /^﻿Nama;Harga;Kategori/);
    await bulk.getByLabel("Pilih file CSV").setInputFiles(F("notes.xlsx"));
    await bulk.getByRole("alert").filter({ hasText: "Simpan sebagai → CSV" }).waitFor();
    await bulk.getByLabel("Pilih file CSV").setInputFiles(F("produk.csv"));
    await list.waitFor();
    assert.equal(await list.getByRole("listitem").count(), 3);
    await bulk.getByText('Status "Kadang" tidak dikenal. Pakai Ready, PO, atau Habis.').waitFor();
    await bulk.getByText("Isi harga.").waitFor();
    await list.getByRole("listitem").nth(0).getByText("3 pilihan").waitFor();
    // fix the two bad rows inline
    await list.getByRole("listitem").nth(1).getByLabel("Harga").fill("60000");
    // editing another field keeps the status warning; choosing a status clears it
    await list.getByRole("listitem").nth(2).getByLabel("Kategori").fill("Syal Rajut");
    await bulk.getByText('Status "Kadang" tidak dikenal. Pakai Ready, PO, atau Habis.').waitFor();
    await list.getByRole("listitem").nth(2).getByLabel("Status").selectOption("preorder");
    await bulk.getByText("semua lengkap").waitFor();
    await list.getByRole("listitem").nth(2).getByText("PO 7 hari").waitFor();
    await shot("bulk-csv");
    await bulk.getByRole("switch", { name: "Tampilkan langsung di katalog" }).click();
    await bulk.getByRole("button", { name: "Simpan 3 produk" }).click();
    await page.getByText("3 produk ditambahkan").last().waitFor();
    db = await page.evaluate(() => globalThis.__db);
    const flanel = db.products.find((p) => p.name === "Kemeja Flanel");
    assert.equal(flanel.price, 135000);
    assert.deepEqual(flanel.options.map((o) => o.label), ["S", "M", "L"]);
    assert.equal(flanel.published, false, "switch off -> hidden");
    assert.deepEqual(db.inventory[flanel.id], { cost: 80000, stock: 10 });
    assert.equal(db.products.find((p) => p.name === "Topi Rajut").price, 60000);
    const syal = db.products.find((p) => p.name === "Syal");
    assert.equal(syal.availability, "preorder");
    assert.equal(syal.leadTime, "7 hari");
    assert.equal(syal.category, "Syal Rajut");

    // paste from a spreadsheet (tabs)
    await page.getByRole("button", { name: "Tambah banyak" }).click();
    await bulk.getByLabel("Atau tempel dari spreadsheet").fill("Nama\tHarga\tKategori\nKaos Polos\t75.000\tPakaian\nKaus Kaki\t15000\tAksesoris");
    await bulk.getByRole("button", { name: "Baca tempelan" }).click();
    await bulk.getByText("semua lengkap").waitFor();
    await bulk.getByRole("button", { name: "Simpan 2 produk" }).click();
    await page.getByText("2 produk ditambahkan").last().waitFor();
    db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.products.find((p) => p.name === "Kaos Polos").price, 75000);
    assert.equal(db.products.length, before + 8);
    await page.getByRole("list", { name: "Daftar produk" }).getByText("Kaus Kaki").waitFor();

    assert.deepEqual(errors, []);
    console.log(`PASS bulk add + cropper ${tag}`);
    await ctx.close();
  });
}
