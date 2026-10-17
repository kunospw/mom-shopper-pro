import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
const shots = process.env.E2E_SHOTS;
const rp = (t) => { const neg = /−|-/.test(t); const n = Number(t.replace(/[^\d]/g, "")); return neg ? -n : n; };
for (const [w, h, tag, dark] of [[1440, 1000, "d"], [390, 844, "m"], [1440, 1000, "dark", true]]) {
  test(`Laporan · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? "dark" : "light" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await page.waitForTimeout(500);
    await page.goto(`${B}/reports`);
    await page.getByRole("heading", { name: "Rincian keuntungan" }).waitFor();

    async function checkIdentity(label) {
      const rows = await page.locator("dl").filter({ hasText: "Laba kotor" }).locator("> div").evaluateAll((els) => els.map((e) => [e.querySelector("dt > span").textContent.replace(/^[−=]\s*/, "").trim(), e.querySelector("dd").innerText]));
      const v = Object.fromEntries(rows.map(([k, t]) => [k, t]));
      const n = (k) => (v[k] === undefined ? 0 : Math.abs(rp(v[k])));
      const gross = n("Penjualan") - n("Pengembalian dana") - n("Modal barang terjual");
      assert.equal(rp(v["Laba kotor"]), gross, `${label} gross ${JSON.stringify(v)}`);
      const net = gross - n("Biaya transaksi") - n("Biaya usaha") - n("Ongkir pembelian");
      assert.equal(rp(v["Keuntungan bersih"]), net, `${label} net`);
      const kpi = await page.getByRole("region", { name: "Ringkasan periode" }).getByText(/Rp/).nth(1).innerText();
      assert.equal(rp(kpi), net, `${label} KPI net matches breakdown`);
      return v;
    }
    const month = await checkIdentity("this month");
    assert.equal(rp(month["Biaya usaha"]), -150000);
    assert.equal(rp(month["Ongkir pembelian"]), -45000);
    if (tag !== "m") await page.getByText(/dari periode/).first().waitFor();
    await page.getByText("Produk terlaris").waitFor();
    await page.getByText("Pelanggan teratas").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    if (shots) await page.screenshot({ path: `${shots}/reports-${tag}.png`, fullPage: tag !== "dark" });

    await page.getByRole("button", { name: "6 bulan" }).click();
    const six = await checkIdentity("6 months");
    assert.ok(rp(six["Penjualan"]) > rp(month["Penjualan"]));
    assert.equal(rp(six["Biaya usaha"]), -900000, "6 x 150.000");
    // chart table for screen readers has one row per month
    assert.equal(await page.locator("table caption", { hasText: "per periode" }).locator("xpath=..").locator("tbody tr").count(), 6);

    // custom range with no data -> empty state
    await page.getByRole("button", { name: "Atur tanggal" }).click();
    await page.getByLabel("Dari tanggal").fill("2020-01-01");
    await page.getByLabel("Sampai tanggal").fill("2020-01-31");
    await page.getByText("Belum ada catatan pada periode ini.").waitFor();
    await page.getByText("1 Januari 2020 – 31 Januari 2020").waitFor();

    assert.deepEqual(errors, []);
    console.log(`PASS reports ${tag}`);
    await ctx.close();
  });
}
