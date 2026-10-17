import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";

test("Pencarian dan angka Beranda", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard search lives in the desktop top bar");
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  await page.evaluate(seedSource);
  await page.reload();
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  // "/" focuses search; arrow + Enter opens the invoice
  await page.keyboard.press("/");
  await page.keyboard.type("Rini");
  const box = page.getByRole("combobox", { name: /Cari pelanggan/ });
  assert.equal(await box.getAttribute("aria-expanded"), "true");
  await page.getByRole("option", { name: /Rini Susanti/ }).first().waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/sales\?/);
  // Beranda numbers come from the shared report builder
  await page.goto("/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  const total = async () => (await page.getByText("Total penjualan", { exact: true }).locator("..").innerText()).match(/Rp\s?[\d.]+/)[0];
  const month = await total();
  const expected = await page.evaluate(() => {
    const now = new Date();
    return globalThis.__db.sales.filter((s) => { const d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.fulfillment.status !== "cancelled"; }).reduce((a, s) => a + s.total, 0);
  });
  assert.equal(month.replace(/\D/g, ""), String(expected), "Bulan ini total");
  await page.getByRole("button", { name: "Tahun ini" }).click();
  assert(Number((await total()).replace(/\D/g, "")) > expected, "year > month");
  await page.getByRole("button", { name: "7 hari", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "7 hari", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("figure table tbody tr").count(), 7, "accessible chart table, one row per day");
  assert.deepEqual(errors, []);
});
