import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function bundle(file) {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(`../${file}`, import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm",
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
const im = await bundle("src/lib/product-import.ts");
const img = await bundle("src/lib/catalog-image.ts");

// ---- table parsing: comma, semicolon, tab, quotes, BOM, CRLF, blank lines ----
assert.deepEqual(im.parseTable("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
assert.deepEqual(im.parseTable("﻿Nama;Harga\r\nKue;10.000\r\n\r\n"), [["Nama", "Harga"], ["Kue", "10.000"]]);
assert.deepEqual(im.parseTable("Nama\tHarga\nKue, enak\t10000"), [["Nama", "Harga"], ["Kue, enak", "10000"]], "tab paste keeps commas");
assert.deepEqual(im.parseTable('Nama,Deskripsi\n"Kue ""spesial""","baris 1\nbaris 2, koma"'), [["Nama", "Deskripsi"], ['Kue "spesial"', "baris 1\nbaris 2, koma"]]);
assert.deepEqual(im.parseTable('Nama;Pilihan\n"A;B";S, M'), [["Nama", "Pilihan"], ["A;B", "S, M"]], "semicolon wins over commas inside cells");

// ---- amounts ----
for (const [input, out] of [["Rp 150.000", 150000], ["150000", 150000], ["150.000,00", 150000], ["150,000", 150000], ["Rp150.000", 150000], ["", null]])
  assert.equal(im.parseAmount(input), out, input);
assert.ok(Number.isNaN(im.parseAmount("seratus ribu")));

// ---- options ----
assert.deepEqual(im.parseOptions("S, M, L"), [{ label: "S", price: 0 }, { label: "M", price: 0 }, { label: "L", price: 0 }]);
assert.deepEqual(im.parseOptions("Hitam:150.000 | Putih:160000"), [{ label: "Hitam", price: 150000 }, { label: "Putih", price: 160000 }]);
assert.deepEqual(im.parseOptions(""), []);
assert.equal(im.parseOptions("Hitam:mahal"), null);

// ---- header mapping (Indonesian/English, any case/punctuation) ----
assert.deepEqual(im.mapHeader(["NAMA PRODUK", "Harga (Rp)", "kategori", "Stok"]), { name: 0, price: 1, category: 2, stock: 3 });
assert.deepEqual(im.mapHeader(["Name", "Price", "Variants"]), { name: 0, price: 1, options: 2 });

// ---- template round-trips into valid rows ----
const fromTemplate = im.rowsFromTable(im.templateCsv());
assert.equal(fromTemplate.rows.length, 3);
for (const row of fromTemplate.rows) assert.deepEqual(row.errors, [], `line ${row.line}: ${row.errors}`);
const [gamis, hijab, ebook] = fromTemplate.rows;
assert.equal(gamis.fields.price, 189000);
assert.equal(gamis.fields.options.length, 4);
assert.deepEqual(gamis.inventory, { cost: 104000, stock: 12 });
assert.equal(hijab.fields.availability, "preorder");
assert.equal(hijab.fields.leadTime, "7 hari");
assert.deepEqual(hijab.fields.options, [{ label: "Hitam", price: 45000 }, { label: "Mocca", price: 47000 }]);
assert.deepEqual(hijab.inventory, { cost: 22000, stock: null });
assert.equal(ebook.fields.kind, "digital");
assert.equal(ebook.inventory, null);
assert.equal(gamis.fields.published, true, "publish default on");
assert.equal(im.rowsFromTable(im.templateCsv(), false).rows[0].fields.published, false);

// ---- row errors are specific, line numbers match the sheet ----
const bad = im.rowsFromTable("Nama,Harga,Status,Tampil\n,10000,Ready,\nKue,abc,Ready,\nTas,50000,Kadang,\nDompet,20000,PO,tidak");
assert.deepEqual(bad.rows.map((r) => r.line), [2, 3, 4, 5]);
assert.deepEqual(bad.rows[0].errors, ["Nama produk kosong."]);
assert.match(bad.rows[1].errors[0], /Harga "abc"/);
assert.equal(bad.rows[1].errors.length, 1, "no duplicate price message");
assert.match(bad.rows[2].errors[0], /Status "Kadang"/);
assert.deepEqual(bad.rows[3].errors, [], "PO without estimate gets a default");
assert.equal(bad.rows[3].fields.leadTime, "7 hari");
assert.equal(bad.rows[3].fields.published, false, "Tampil: tidak");

// ---- missing columns, empty, row cap ----
assert.match(im.rowsFromTable("Produk;Kategori\nKue;Makanan").error, /Nama.*Harga/);
assert.match(im.rowsFromTable("Nama,Harga").error, /Tidak ada baris/);
const many = "Nama,Harga\n" + Array.from({ length: 60 }, (_, i) => `P${i},1000`).join("\n");
const capped = im.rowsFromTable(many);
assert.equal(capped.rows.length, im.MAX_IMPORT_ROWS);
assert.equal(capped.skipped, 10);

// ---- names from photo files ----
assert.equal(im.nameFromFile("gamis-katun_rayon (2).JPG"), "Gamis Katun Rayon");
assert.equal(im.nameFromFile("IMG_20240101_1234.jpg"), "20240101 1234");
assert.equal(im.rowFromPhoto("IMG_20240101_1234.jpg", 1).fields.name, "", "camera numbers are not names");
assert.equal(im.rowFromPhoto("WhatsApp Image hijab mocca.jpeg", 1).fields.name, "Hijab Mocca");
assert.ok(im.rowFromPhoto("x.jpg", 1).errors.length > 0, "needs a price");

// ---- crop math stays inside the image ----
assert.deepEqual(img.cropRect(1000, 500, img.centerCrop), { side: 500, left: 250, top: 0, zoom: 1 }, "landscape: centered square");
assert.deepEqual(img.cropRect(500, 1000, img.centerCrop), { side: 500, left: 0, top: 250, zoom: 1 }, "portrait");
assert.deepEqual(img.cropRect(1000, 500, { x: 0, y: 0, zoom: 1 }), { side: 500, left: 0, top: 0, zoom: 1 }, "clamped left");
assert.deepEqual(img.cropRect(1000, 500, { x: 1, y: 1, zoom: 2 }), { side: 250, left: 750, top: 250, zoom: 2 }, "clamped bottom-right, zoomed");
assert.equal(img.cropRect(800, 800, { x: 0.5, y: 0.5, zoom: 99 }).zoom, img.MAX_ZOOM);

console.log("product import: CSV/Excel parsing, amounts, options, template, row errors, photo names, crop math: PASS");
