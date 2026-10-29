import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { context, handleCatalogue, db } from "../catalog/ingestion-context.mjs";
import { signIn } from "../integration/support/app.mjs";

async function signedSeller(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await signIn(page, { name: "Seller", email: `seller-${crypto.randomUUID()}@example.test` });
  return context.verify(await page.evaluate(() => globalThis.__emulatorIdToken()));
}

test("upload → private drafts → seller correction → explicit atomic confirmation", async ({ page }) => {
  const seller = await signedSeller(page);
  const products = db.collection(`storefronts/${seller.uid}/products`);
  let ocr = 0;
  const ctx = { ...context, adapters: { ...context.adapters, ocr: async () => { ocr++; return "Kemeja tanpa harga. Tas Rp25000."; } } };
  await page.route("**/api/ingest-catalogue", async route => {
    const request = route.request();
    const result = await handleCatalogue(request.postDataJSON(), request.headers().authorization, ctx);
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Impor katalog AI", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Berkas katalog").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await dialog.getByRole("button", { name: "Buat draf produk" }).click();
  await expect(dialog.getByRole("heading", { name: "Periksa draf produk" })).toBeVisible();
  expect((await products.get()).size).toBe(0);
  const confirm = dialog.getByRole("button", { name: "Simpan 2 produk" });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByText("Harga wajib diisi")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("draft-review.png"), fullPage: true });
  await dialog.getByLabel("Harga Rupiah", { exact: true }).first().fill("125000");
  await expect(confirm).toBeDisabled();
  if (test.info().project.name === "desktop") {
    await dialog.getByRole("button", { name: "Simpan draf" }).click();
    await expect(dialog.getByRole("button", { name: "Simpan draf" })).toBeDisabled();
  }
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(dialog.getByRole("heading", { name: "Produk berhasil disimpan" })).toBeVisible();
  const saved = await products.get();
  expect(saved.size).toBe(2);
  expect(saved.docs.every(d => d.data().published === false)).toBe(true);
  expect(saved.docs.find(d => d.data().name === "Kemeja").data().price).toBe(125000);
  // Reload and resubmit exactly the same file: same receipt, no duplicate extraction/products.
  await page.reload();
  await expect(dialog.getByRole("heading", { name: "Produk berhasil disimpan" })).toBeVisible();
  await dialog.getByRole("button", { name: "Impor katalog lain" }).click();
  await dialog.getByLabel("Berkas katalog").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await dialog.getByRole("button", { name: "Buat draf produk" }).click();
  await expect(dialog.getByRole("heading", { name: "Produk berhasil disimpan" })).toBeVisible();
  expect((await products.get()).size).toBe(2);
  expect(ocr).toBe(1);
  await dialog.getByRole("button", { name: "Tutup formulir" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Daftar produk" }).getByText("Kemeja", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("unsupported upload, slow processing, failure and safe retry", async ({ page }) => {
  const seller = await signedSeller(page);
  let fail = true;
  const ctx = { ...context, adapters: { ...context.adapters, ocr: async () => {
    if (fail) { await new Promise(resolve => setTimeout(resolve, 8000)); throw new Error("provider-secret-must-not-leak"); }
    return "Kemeja tanpa harga. Topi Rp15.000";
  } } };
  await page.route("**/api/ingest-catalogue", async route => {
    const request = route.request();
    const result = await handleCatalogue(request.postDataJSON(), request.headers().authorization, ctx);
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto("/catalog?new=catalogue");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Berkas katalog").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("text") });
  await dialog.getByRole("button", { name: "Buat draf produk" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Gunakan PDF/JPEG/PNG");
  await dialog.getByLabel("Berkas katalog").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await dialog.getByRole("button", { name: "Buat draf produk" }).click();
  await expect(dialog.getByText(/Masih diproses/)).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByRole("heading", { name: "Katalog belum dapat dibaca" })).toBeVisible();
  await expect(dialog).not.toContainText("provider-secret-must-not-leak");
  fail = false;
  await dialog.getByRole("button", { name: "Buat draf produk" }).click();
  await expect(dialog.getByRole("heading", { name: "Periksa draf produk" })).toBeVisible();
  // The mocked model omits Topi; its source price is shown, not turned into a draft.
  await expect(dialog.getByText(/Harga di katalog yang belum ada di draf/)).toContainText("Rp 15.000");
  expect((await db.collection(`storefronts/${seller.uid}/products`).get()).size).toBe(0);
});

test("Shopee share text → private draft → seller's own price → explicit confirmation", async ({ page }) => {
  const seller = await signedSeller(page);
  const products = db.collection(`storefronts/${seller.uid}/products`);
  const ctx = { ...context, adapters: { ...context.adapters, shopee: async () => ({ shopId: "11487927", itemId: "1022856848" }) } };
  await page.route("**/api/ingest-catalogue", async route => {
    const request = route.request();
    const result = await handleCatalogue(request.postDataJSON(), request.headers().authorization, ctx);
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
  });
  await page.goto("/catalog?new=catalogue");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Teks bagikan Shopee").fill("tanpa tautan");
  await dialog.getByRole("button", { name: "Buat draf dari Shopee" }).click();
  await expect(dialog.getByRole("alert")).toContainText("s.shopee.co.id");
  await dialog.getByLabel("Teks bagikan Shopee").fill("Cek Oral-B Sikat Gigi All Rounder 123 Clean Soft 3s dengan harga Rp22.600. Dapatkan di Shopee sekarang! https://s.shopee.co.id/8VA3gNI6dZ");
  await dialog.getByRole("button", { name: "Buat draf dari Shopee" }).click();
  await expect(dialog.getByRole("heading", { name: "Periksa draf produk" })).toBeVisible();
  await expect(dialog.getByText("Harga di Shopee:")).toContainText("Rp 22.600");
  await expect(dialog.getByLabel("Nama produk")).toHaveValue("Oral-B Sikat Gigi All Rounder 123 Clean Soft 3s");
  await expect(dialog.getByRole("link", { name: "Buka di Shopee" })).toHaveAttribute("href", "https://s.shopee.co.id/8VA3gNI6dZ");
  await expect(dialog.getByText("Harga wajib diisi")).toBeVisible();
  await dialog.getByRole("button", { name: "Pakai Rp 22.600" }).click();
  await expect(dialog.getByLabel("Harga Rupiah", { exact: true })).not.toHaveValue("");
  await dialog.getByLabel("Harga Rupiah", { exact: true }).fill("27500");
  await expect(dialog.getByText("Foto wajib diisi")).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toBeDisabled();
  await dialog.getByLabel("Foto produk").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await expect(dialog.getByRole("img", { name: "Foto produk 1" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("shopee-review.png"), fullPage: true });
  expect((await products.get()).size).toBe(0);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Simpan 1 produk" }).click();
  await expect(dialog.getByRole("heading", { name: "Produk berhasil disimpan" })).toBeVisible();
  const saved = await products.get();
  expect(saved.size).toBe(1);
  expect(saved.docs[0].data().price).toBe(27500);
  expect(saved.docs[0].data().image).toMatch(/^data:image\/webp;base64,/);
  expect(saved.docs[0].data().published).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
