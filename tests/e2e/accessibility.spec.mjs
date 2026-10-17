import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { freshApp, readDb, workspacePages } from "./support/helpers.mjs";

/**
 * Automated WCAG 2.1 A/AA scan (axe-core) of every screen, light and dark.
 * Fails on serious or critical violations; lists them with the elements.
 */
async function scan(page, label) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: [${v.impact}] ${v.id} – ${v.help}\n    ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join("\n    ")}`);
}

for (const scheme of ["light", "dark"]) {
  test(`axe · workspace · ${scheme}`, async ({ browser }, info) => {
    test.skip(scheme === "dark" && info.project.name === "phone", "dark is scanned once, on desktop");
    const ctx = await browser.newContext({ viewport: info.project.use.viewport, colorScheme: scheme });
    const page = await ctx.newPage();
    await freshApp(page, { seed: true });
    const problems = [];
    for (const { path, heading } of workspacePages) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1, name: heading }).first().waitFor();
      await page.waitForTimeout(300);
      problems.push(...(await scan(page, path)));
    }
    // panels and dialogs
    const sale = (await readDb(page)).sales[0];
    for (const [path, name] of [[`/sales?view=${sale.id}`, null], ["/sales?new=1", "Catat penjualan"], ["/catalog?new=product", "Tambah produk"], ["/catalog?new=bulk", "Tambah banyak produk"], ["/costs?new=purchase", "Catat pembelian stok"]]) {
      await page.goto(path);
      await (name ? page.getByRole("dialog", { name }) : page.getByRole("dialog")).first().waitFor();
      await page.waitForTimeout(500);
      problems.push(...(await scan(page, path)));
    }
    await ctx.close();
    assert.deepEqual(problems, [], "\n" + problems.join("\n"));
  });
}

test("axe · buyer shop, product, cart, order status, login, 404", async ({ page }) => {
  await freshApp(page, { seed: true });
  const problems = [];
  const order = (await readDb(page)).orders[0];
  await page.goto("/shop/tokomelati");
  await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
  problems.push(...(await scan(page, "shop")));
  await page.getByRole("button", { name: /^Lihat Voucher Game/ }).click();
  await page.getByRole("button", { name: /^Tambah · / }).waitFor();
  problems.push(...(await scan(page, "product")));
  await page.getByRole("button", { name: /^Tambah · / }).click();
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").waitFor();
  problems.push(...(await scan(page, "cart")));
  await page.goto(`/shop/tokomelati/order/${order.id}`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(500);
  problems.push(...(await scan(page, "order status")));
  await page.goto("/shop/tidak-ada-toko");
  await page.waitForTimeout(800);
  problems.push(...(await scan(page, "shop not found")));
  await page.goto("/login?auth=out");
  await page.getByRole("heading", { name: "Selamat datang" }).first().waitFor();
  problems.push(...(await scan(page, "login")));
  await page.goto("/tidak-ada");
  await page.getByRole("heading", { name: "Halaman Tidak Ditemukan" }).waitFor();
  problems.push(...(await scan(page, "404")));
  assert.deepEqual(problems, [], "\n" + problems.join("\n"));
});
