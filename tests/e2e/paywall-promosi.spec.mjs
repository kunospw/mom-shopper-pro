import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
for (const [w, h, tag] of [[1440, 1000, "d"], [390, 844, "m"]]) {
  test(`Paket dan Promosi · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "wa" }));
    const shot = (n) => shots && page.screenshot({ path: `${shots}/${n}-${tag}.png` });
    const patchDb = (src) => page.evaluate((s) => { const d = globalThis.__db; new Function("d", s)(d); localStorage.setItem("__mockdb_v1", JSON.stringify(d)); }, src);
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await patchDb(`d.entitlement = { trialStartedAt: new Date(Date.now() - 8*86400000).toISOString(), paidUntil: null };`);
    await page.reload();
    await page.getByRole("heading", { name: /Halo/ }).waitFor();

    // expired: notice -> paywall -> upgrade link with account code
    await page.getByRole("status").filter({ hasText: "Masa uji coba berakhir" }).first().waitFor();
    await page.getByRole("button", { name: "Lihat paket" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Rp 49.000").waitFor();
    await dialog.getByText("Selalu gratis, dengan atau tanpa paket").waitFor();
    const href = await dialog.getByRole("link", { name: "Upgrade lewat WhatsApp" }).getAttribute("href");
    const url = new URL(href);
    assert.equal(url.host + url.pathname, "wa.me/6281298590798");
    const text = url.searchParams.get("text");
    assert(text.includes("Kode akun: u1") && text.includes("Toko Melati") && text.includes("Rp 49.000") && text.startsWith("Halo, saya ingin berlangganan LarisKu"), text);
    await shot("paywall");
    // not yet paid
    await dialog.getByRole("button", { name: /Saya sudah bayar/ }).click();
    await dialog.getByText(/Belum aktif/).waitFor();
    // operator activates -> check flips to active
    await page.evaluate(() => { globalThis.__db.entitlement.paidUntil = new Date(Date.now() + 30 * 86400000).toISOString(); });
    await dialog.getByRole("button", { name: /Saya sudah bayar/ }).click();
    await dialog.getByText("Paket aktif. Terima kasih!").waitFor();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole("status").filter({ hasText: "Masa uji coba berakhir" }).count(), 0, "notice gone once paid");

    // sidebar/menu pill and Langganan settings
    if (tag === "d") await page.getByRole("link", { name: /Paket aktif/ }).click();
    else {
      await page.getByRole("button", { name: "Lainnya" }).click();
      await page.getByRole("link", { name: /Paket aktif/ }).click();
    }
    await page.getByRole("heading", { name: "Langganan" }).waitFor();
    await page.getByText("Paket aktif sampai").first().waitFor();
    await page.getByText("u1", { exact: true }).waitFor();
    await shot("langganan");

    // trial with 2 days left shows the upgrade button on Beranda
    await patchDb(`d.entitlement = { trialStartedAt: new Date(Date.now() - 5.5*86400000).toISOString(), paidUntil: null };`);
    await page.goto(`${B}/`);
    await page.getByText(/Uji coba gratis: sisa 2 hari/).waitFor();
    await page.getByRole("button", { name: "Lihat paket" }).waitFor();

    // Promosi
    await page.goto(`${B}/promote`);
    await page.getByRole("heading", { name: "Promosi" }).waitFor();
    const list = page.getByRole("list", { name: "Produk untuk promosi" });
    assert.equal(await list.getByRole("button", { pressed: true }).count(), 3, "first three preselected");
    await list.getByRole("button", { name: /Kemeja Linen/ }).click();
    await page.getByRole("button", { name: "Promo", exact: true }).click();
    await page.getByLabel(/Judul/).fill("Diskon 10% sampai Minggu");
    const preview = await page.getByRole("region", { name: "Pratinjau pesan" }).innerText();
    assert(preview.includes("Promo spesial dari Toko Melati") && preview.includes("Diskon 10% sampai Minggu") && preview.includes("/shop/tokomelati?product="), preview);
    const wa = await page.getByRole("link", { name: "Kirim ke WhatsApp" }).getAttribute("href");
    assert(wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes("Diskon 10%"));
    await page.getByLabel(/Versi status/).check();
    assert(!(await page.getByRole("region", { name: "Pratinjau pesan" }).innerText()).includes("?product="), "status version");
    await page.getByRole("img", { name: /Pratinjau gambar Status/ }).waitFor();
    await shot("promosi");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh gambar" }).click()]);
    assert.equal(download.suggestedFilename(), "promo-tokomelati-story.png");
    const path = await download.path();
    const fs = await import("node:fs");
    const png = fs.readFileSync(path);
    assert.equal(png.readUInt32BE(16), 1080, "png width");
    assert.equal(png.readUInt32BE(20), 1920, "png height");
    await page.getByRole("button", { name: /Postingan 1:1/ }).click();
    const [post] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh gambar" }).click()]);
    const postPng = fs.readFileSync(await post.path());
    assert.deepEqual([postPng.readUInt32BE(16), postPng.readUInt32BE(20)], [1080, 1080], "post size");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no overflow " + tag);

    // expired gate on Promosi
    await patchDb(`d.entitlement = { trialStartedAt: new Date(Date.now() - 9*86400000).toISOString(), paidUntil: null };`);
    await page.goto(`${B}/promote`);
    await page.getByRole("heading", { name: "Masa uji coba berakhir" }).waitFor();
    await page.getByRole("button", { name: "Lihat paket" }).last().click();
    await page.getByRole("dialog").getByText("Rp 49.000").waitFor();

    assert.deepEqual(errors, [], tag);
    await ctx.close();
    console.log("PASS", tag);
  });
}
