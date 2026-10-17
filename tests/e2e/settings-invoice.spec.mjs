import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
for (const [w, h, tag, dark] of [[1440, 1000, "d"], [390, 844, "m"], [1440, 1000, "dark", true]]) {
  test(`Pengaturan dan invoice · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? "dark" : "light", acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const shot = (n) => shots && page.screenshot({ path: `${shots}/${n}-${tag}.png` });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await page.waitForTimeout(500);

    // ---- settings ----
    await page.goto(`${B}/settings/business`);
    await page.getByRole("heading", { name: "Informasi bisnis" }).waitFor();
    const save = page.getByRole("button", { name: "Simpan bisnis" });
    assert.equal(await save.isDisabled(), true, "nothing to save yet");
    await page.getByLabel("Nama bisnis").fill("Toko Melati Jaya");
    await page.getByRole("radio", { name: /Biru/ }).click();
    await page.getByRole("navigation", { name: "Bagian pengaturan" }).getByLabel("Perubahan belum disimpan").waitFor();
    assert.equal(await overflow(), 0);
    await shot("settings-business");
    await save.click();
    await page.waitForFunction(() => (globalThis.__patches || []).length > 0);
    const patch = await page.evaluate(() => globalThis.__patches.at(-1));
    assert.equal(patch.businessName, "Toko Melati Jaya");
    assert.equal(patch.businessAccent, "blue");

    await page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: /Pembayaran/ }).click();
    await page.getByRole("heading", { name: "Rekening bank" }).waitFor();
    await page.getByRole("button", { name: "Tambah rekening" }).click();
    await page.getByLabel("Nama bank").nth(1).fill("Mandiri");
    await page.getByLabel("Nomor rekening").nth(1).fill("9988776655");
    await page.getByLabel("Nama pemilik rekening").nth(1).fill("Sari");
    await shot("settings-payments");
    await page.getByRole("button", { name: "Simpan pembayaran" }).click();
    await page.waitForFunction(() => globalThis.__patches.length > 1);
    const pay = await page.evaluate(() => globalThis.__patches.at(-1));
    assert.equal(pay.bankAccounts.length, 2);
    assert.equal(pay.bankAccounts[1].bankName, "Mandiri");

    await page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: /Tampilan/ }).click();
    await page.getByRole("heading", { name: "Kenyamanan membaca" }).waitFor();
    await page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: /Akun/ }).click();
    await page.getByLabel("Nama lengkap").fill("");
    await page.getByRole("button", { name: "Simpan akun" }).click();
    await page.getByText("Nama lengkap wajib diisi").waitFor();
    await page.getByLabel("Nama lengkap").fill("Sari W");
    await shot("settings-account");
    await page.getByRole("button", { name: "Simpan akun" }).click();
    await page.waitForFunction(() => globalThis.__patches.length > 2);

    // ---- invoice ----
    const sale = await page.evaluate(() => globalThis.__db.sales.find((s) => s.customer.name === "Ayu Lestari" && s.payments.length === 0));
    await page.goto(`${B}/sales?view=${sale.id}`);
    await page.getByRole("button", { name: "Invoice" }).click();
    const inv = page.locator(".invoice-paper");
    await inv.waitFor();
    const text = await inv.innerText();
    assert(/INVOICE/.test(text) && /Sisa tagihan/.test(text) && /Transfer bank/.test(text) && /Mukena Travel Parasut/.test(text), text);
    assert.equal(await inv.evaluate((e) => getComputedStyle(e).backgroundColor), "rgb(255, 255, 255)", "paper stays white");
    assert.equal(await overflow(), 0);
    await page.waitForTimeout(300);
    await shot("invoice");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh PDF" }).click()]);
    assert.match(download.suggestedFilename(), /^Invoice-AyuLestari-.+\.pdf$/);

    assert.deepEqual(errors, []);
    console.log(`PASS settings + invoice ${tag}`);
    await ctx.close();
  });
}
