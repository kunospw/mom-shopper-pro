import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
async function noOverflow(page, label) {
  const bad = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? { sw: d.scrollWidth, cw: d.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth } : null;
  });
  assert(bad && bad.sw <= bad.cw + 1 && bad.doc <= bad.vw + 1, `${label}: overflow ${JSON.stringify(bad)}`);
}
for (const [w, h, tag] of [[1440, 1000, "d"], [393, 852, "m"]]) {
  test(`Setup toko baru dan editor toko · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const shot = (n) => shots && page.screenshot({ path: `${shots}/${n}-${tag}.png` });
    const patchDb = (src) => page.evaluate((s) => { const d = globalThis.__db; new Function("d", s)(d); localStorage.setItem("__mockdb_v1", JSON.stringify(d)); }, src);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await patchDb(`d.store = null; d.entitlement = null; d.products = []; d.slugs = { "toko-melati": "u2" };`);

    // brand-new owner: Beranda checklist link opens the guided setup
    await page.goto(`${B}/catalog`);
    await page.getByRole("button", { name: "Buat toko" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Buat toko online Anda" }).waitFor();
    await dialog.getByText("Membuka toko memulai uji coba gratis 7 hari.").waitFor();
    await page.waitForTimeout(300);
    await noOverflow(page, "intro");
    await shot("0-intro");
    await dialog.getByRole("button", { name: "Mulai" }).click();

    // step 1: name -> link suggested; taken link blocks
    await dialog.getByText("Langkah 1 dari 5").waitFor();
    const name = dialog.getByLabel("Nama toko");
    await name.fill("Toko Melati");
    await dialog.getByText("Tautan ini sudah dipakai. Coba nama lain.").waitFor();
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByLabel("Tautan toko").waitFor(); // link field opened to fix it
    await name.fill("Faeza Store");
    // edited link field stays in sync until the owner types in it
    assert.equal(await dialog.getByLabel("Tautan toko").inputValue(), "faeza-store");
    await dialog.getByText("Tautan ini tersedia.").waitFor();
    await dialog.getByText(/shop\/faeza-store/).first().waitFor();
    await noOverflow(page, "name");
    await shot("1-name");
    await dialog.getByRole("button", { name: "Lanjut" }).click();

    // step 2: WhatsApp required, 08 accepted
    await dialog.getByText("Langkah 2 dari 5").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Ke mana pesanan dikirim?");
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByRole("alert").filter({ hasText: "Nomor belum lengkap" }).waitFor();
    await dialog.getByLabel("Nomor WhatsApp pesanan").fill("0812 3456 7890");
    await dialog.getByText("+62 812-3456-7890").waitFor();
    assert.equal(await dialog.getByRole("link", { name: /Cek nomor/ }).getAttribute("href"), "https://wa.me/6281234567890");
    await noOverflow(page, "whatsapp");
    await shot("2-whatsapp");
    await dialog.getByLabel("Nomor WhatsApp pesanan").press("Enter"); // Enter advances

    // step 3: delivery and payment; a payment method is required
    await dialog.getByText("Langkah 3 dari 5").waitFor();
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByRole("alert").filter({ hasText: "Pilih minimal satu cara pembayaran" }).waitFor();
    await dialog.getByLabel("Antar ke alamat").check();
    await dialog.getByLabel("Ambil di tempat").check();
    await dialog.getByLabel("QRIS").check();
    await dialog.getByLabel("Transfer bank").check();
    await noOverflow(page, "orders");
    await shot("3-orders");
    await dialog.getByRole("button", { name: "Lanjut" }).click();

    // step 4: look
    await dialog.getByText("Langkah 4 dari 5").waitFor();
    await dialog.getByRole("radio", { name: /Biru/ }).click();
    assert.equal(await dialog.getByRole("radio", { name: /Biru/ }).getAttribute("aria-checked"), "true");
    await dialog.getByRole("button", { name: "Ready & PO" }).click();
    assert.match(await dialog.getByLabel(/Tentang toko/).inputValue(), /ready stock/);
    await noOverflow(page, "look");
    await page.waitForTimeout(400);
    await shot("4-look");
    await dialog.getByRole("button", { name: "Lanjut ke pratinjau" }).click();

    // step 5: review; "Ubah" goes back, then open
    await dialog.getByText("Langkah 5 dari 5").waitFor();
    await dialog.getByText("+62 812-3456-7890").waitFor();
    await dialog.getByText("Antar ke alamat, Ambil di tempat").waitFor();
    await dialog.getByText("Transfer bank, QRIS").waitFor();
    await dialog.getByText("Biru", { exact: true }).waitFor();
    await noOverflow(page, "review");
    await shot("5-review");
    await dialog.getByRole("button", { name: "Ubah WhatsApp" }).click();
    await dialog.getByText("Langkah 2 dari 5").waitFor();
    assert.equal(await dialog.getByLabel("Nomor WhatsApp pesanan").inputValue(), "0812 3456 7890", "kept when going back");
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByRole("button", { name: "Lanjut ke pratinjau" }).click();
    await dialog.getByRole("button", { name: "Buka toko sekarang" }).click();

    // done: saved with normalized number + trial started; next is the first product
    await dialog.getByRole("heading", { name: "Toko Anda sudah buka!" }).waitFor();
    const db = await page.evaluate(() => globalThis.__db);
    assert.equal(db.store.name, "Faeza Store");
    assert.equal(db.store.slug, "faeza-store");
    assert.equal(db.store.whatsapp, "6281234567890");
    assert.equal(db.store.accent, "blue");
    assert.deepEqual([db.store.delivery, db.store.payments], [["deliver", "pickup"], ["transfer", "qris"]]);
    assert.equal(db.store.published, true);
    assert.ok(db.entitlement?.trialStartedAt, "trial started");
    assert.match(await dialog.getByRole("textbox", { name: "Tautan toko" }).inputValue(), /\/shop\/faeza-store$/);
    await noOverflow(page, "done");
    await shot("6-done");
    await dialog.getByRole("button", { name: "Tambah produk pertama" }).click();
    await dialog.getByRole("heading", { name: "Tambah produk" }).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Atur toko" }).waitFor();

    // existing shop: regular editor, no overflow on phones, 08 normalized on save
    await page.goto(`${B}/catalog?store=edit`);
    await dialog.getByRole("heading", { name: "Toko publik" }).waitFor();
    await page.waitForTimeout(300);
    await noOverflow(page, "editor");
    await shot("7-editor");
    assert.equal(await dialog.getByLabel("QRIS").isChecked(), true, "editor shows the saved choices");
    await dialog.getByLabel("Nomor WhatsApp pesanan").fill("0857-1111-2222");
    await dialog.getByText("+62 857-1111-2222").waitFor();
    await dialog.getByRole("radio", { name: /Ungu/ }).click();
    await dialog.getByRole("button", { name: "Simpan toko" }).click();
    await page.getByText("Pengaturan toko disimpan").waitFor();
    const after = await page.evaluate(() => globalThis.__db.store);
    assert.equal(after.whatsapp, "6285711112222");
    assert.equal(after.accent, "violet");
    // open shop with an empty number is refused
    await page.goto(`${B}/catalog?store=edit`);
    await dialog.getByLabel("Nomor WhatsApp pesanan").fill("");
    await dialog.getByRole("button", { name: "Simpan toko" }).click();
    await dialog.getByText("Isi nomor WhatsApp supaya pembeli bisa memesan.").waitFor();

    // "Simpan dulu" path: closed shop, no trial
    await patchDb(`d.store = null; d.entitlement = null; d.slugs = {};`);
    await page.goto(`${B}/catalog?store=edit`);
    await dialog.getByRole("button", { name: "Mulai" }).click();
    await dialog.getByLabel("Nama toko").fill("Kue Ibu");
    await dialog.getByText("Tautan ini tersedia.").waitFor();
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByLabel("Nomor WhatsApp pesanan").fill("+62 811 222 333");
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByLabel("Bayar di tempat (COD)").check();
    await dialog.getByRole("button", { name: "Lanjut" }).click();
    await dialog.getByRole("button", { name: "Lanjut ke pratinjau" }).click();
    await dialog.getByRole("button", { name: "Simpan dulu, buka nanti" }).click();
    await dialog.getByRole("heading", { name: "Toko tersimpan" }).waitFor();
    const closed = await page.evaluate(() => globalThis.__db);
    assert.equal(closed.store.published, false);
    assert.equal(closed.store.whatsapp, "62811222333");
    assert.equal(closed.store.slug, "kue-ibu");
    assert.equal(closed.entitlement, null, "no trial when saved closed");

    assert.deepEqual(errors, []);
    console.log(`PASS store setup ${tag}`);
    await ctx.close();
  });
}
