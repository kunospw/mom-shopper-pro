import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { freshApp, noHorizontalOverflow, patchDb, readDb, workspacePages } from "./support/helpers.mjs";

test.describe("Ruang usaha", () => {
  test("every page opens from the menu, with its heading and no errors", async ({ page }, info) => {
    const errors = await freshApp(page, { seed: true });
    const phone = info.project.name === "phone";
    const menu = [
      ["Pesanan", "Pesanan masuk"],
      ["Penjualan", "Penjualan"],
      ["Pelanggan", "Pelanggan"],
      ["Katalog", "Katalog"],
      ["Promosi", "Promosi"],
      ["Pembelian & biaya", "Pembelian & biaya"],
      ["Laporan", "Laporan"],
      ["Pengaturan", "Pengaturan"],
      ["Beranda", /Halo/],
    ];
    for (const [label, heading] of menu) {
      const inBar = ["Beranda", "Pesanan", "Penjualan"].includes(label);
      if (phone && !inBar) {
        await page.getByRole("button", { name: "Lainnya" }).click();
        await page.getByRole("dialog", { name: "Lainnya" }).getByRole("link", { name: new RegExp(`^${label}`) }).click();
      } else {
        // Pengaturan sits under the main nav on desktop, not inside it.
        const scope = label === "Pengaturan" ? page : page.getByRole("navigation", { name: "Navigasi utama" });
        await scope.getByRole("link", { name: new RegExp(`^${label}`) }).first().click();
      }
      await page.getByRole("heading", { level: 1, name: heading }).waitFor();
      await noHorizontalOverflow(page, label);
    }
    assert.deepEqual(errors, []);
  });

  test("deep links open the right panel; unknown pages show 404", async ({ page }) => {
    const errors = await freshApp(page, { seed: true });
    const sale = (await readDb(page)).sales[0];
    await page.goto(`/sales?view=${sale.id}`);
    await page.getByRole("dialog").getByText(sale.number).first().waitFor();
    await page.goto("/sales?new=1");
    await page.getByRole("dialog", { name: "Catat penjualan" }).waitFor();
    await page.goto("/costs?new=expense");
    await page.getByRole("dialog", { name: "Catat biaya usaha" }).waitFor();
    await page.goto("/catalog?new=product");
    await page.getByRole("dialog", { name: "Tambah produk" }).waitFor();
    await page.goto("/settings");
    await page.waitForURL(/\/settings\/appearance$/);
    await page.goto("/tidak-ada");
    await page.getByRole("heading", { name: "Halaman Tidak Ditemukan" }).waitFor();
    // NotFound logs the bad path on purpose.
    assert.deepEqual(errors.filter((e) => !/non-existent route/.test(e)), []);
  });

  test("a brand-new account sees helpful empty states everywhere", async ({ page }) => {
    const errors = await freshApp(page);
    await patchDb(page, `d.sales = []; d.purchases = []; d.expenses = []; d.customers = []; d.orders = []; d.products = []; d.inventory = {}; d.store = null; d.entitlement = null; d.slugs = {};`);
    const expect = {
      "/": "Belum ada transaksi. Catat penjualan pertama Anda.",
      "/orders": "Belum ada permintaan baru",
      "/sales": /Belum ada penjualan/,
      "/customers": /Belum ada pelanggan/,
      "/catalog": "Siapkan toko Anda",
      "/promote": "Siapkan toko dulu",
      "/costs": /Belum ada catatan/,
      "/reports": "Belum ada catatan pada periode ini.",
    };
    for (const [path, text] of Object.entries(expect)) {
      await page.goto(path);
      await page.getByText(text).first().waitFor();
      await noHorizontalOverflow(page, path);
    }
    assert.deepEqual(errors, []);
  });

  test("leaving a half-filled form asks first", async ({ page }, info) => {
    const errors = await freshApp(page, { seed: true });
    await page.goto("/sales?new=1");
    const form = page.getByRole("dialog", { name: "Catat penjualan" });
    await form.getByLabel("Nama", { exact: true }).fill("Pelanggan Baru");
    // closing the form (Escape) is an in-app navigation the guard catches
    await page.keyboard.press("Escape");
    const guard = page.getByRole("alertdialog", { name: "Perubahan belum disimpan" });
    await guard.waitFor();
    await guard.getByRole("button", { name: "Lanjutkan mengisi" }).click();
    assert.equal(await form.getByLabel("Nama", { exact: true }).inputValue(), "Pelanggan Baru", "draft kept");
    await page.keyboard.press("Escape");
    await guard.getByRole("button", { name: "Tinggalkan tanpa menyimpan" }).click();
    await form.waitFor({ state: "detached" });
    assert.equal((await readDb(page)).sales.some((s) => s.customer.name === "Pelanggan Baru"), false, "nothing saved");
    if (info.project.name === "desktop") {
      // the same guard protects settings
      await page.goto("/settings/business");
      await page.getByLabel("Nama bisnis").fill("Nama Sementara");
      await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: /^Penjualan/ }).click();
      await guard.waitFor();
      await guard.getByRole("button", { name: "Lanjutkan mengisi" }).click();
      await page.getByRole("heading", { level: 1, name: "Pengaturan" }).waitFor();
    }
    assert.deepEqual(errors, []);
  });

  test("edit and delete a sale keep stock right", async ({ page }) => {
    const errors = await freshApp(page);
    // a sale of 2 × Kemeja Linen (tracked stock 5 → 3)
    await page.evaluate(() =>
      globalThis.__saveSale(
        {
          date: new Date().toISOString(),
          channel: "manual",
          customer: { name: "Wulan", whatsapp: "6281234000111", address: "Depok" },
          items: [{ productId: "p1", name: "Kemeja Linen", option: "Hitam", kind: "physical", quantity: 2, unitPrice: 150000, unitCost: 100000 }],
          shipping: 0, discount: 0, fees: 0, payments: [],
          fulfillment: { status: "confirmed", courier: "", trackingNo: "", deliveryNote: "", updatedAt: new Date().toISOString() },
          notes: "",
        },
        undefined,
        { sequence: 1 },
      ),
    );
    let db = await readDb(page);
    const sale = db.sales[0];
    assert.equal(db.inventory.p1.stock, 3);
    // edit: 2 → 3 pieces
    await page.goto(`/sales?view=${sale.id}`);
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: "Tindakan lain" }).click();
    await page.getByRole("menuitem", { name: "Ubah penjualan" }).click();
    const form = page.getByRole("dialog", { name: `Ubah ${sale.number}` });
    await form.getByRole("group", { name: "Jumlah Kemeja Linen" }).getByRole("button", { name: "Tambah jumlah" }).click();
    await form.getByRole("button", { name: "Simpan perubahan" }).click();
    await page.getByText("Perubahan tersimpan").waitFor();
    db = await readDb(page);
    assert.equal(db.sales[0].total, 450000, "total follows the quantity");
    assert.equal(db.inventory.p1.stock, 2, "stock moves by the difference");
    // delete asks first, then returns the stock
    await page.getByRole("dialog").getByRole("button", { name: "Tindakan lain" }).click();
    await page.getByRole("menuitem", { name: "Hapus" }).click();
    await page.getByRole("alertdialog", { name: `Hapus penjualan ${sale.number}?` }).getByRole("button", { name: "Hapus penjualan" }).click();
    await page.getByText(`Penjualan ${sale.number} dihapus`).waitFor();
    db = await readDb(page);
    assert.equal(db.sales.length, 0);
    assert.equal(db.inventory.p1.stock, 5, "stock back after delete");
    assert.deepEqual(errors, []);
  });

  test("dark mode: every page renders without overflow or errors", async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport, colorScheme: "dark" });
    const page = await ctx.newPage();
    const errors = await freshApp(page, { seed: true });
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")), "dark class applied");
    for (const { path, heading } of workspacePages) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1, name: heading }).first().waitFor();
      await noHorizontalOverflow(page, path);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
});
