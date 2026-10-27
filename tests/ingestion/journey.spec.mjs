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
  await dialog.getByRole("button", { name: "Unggah dan buat draf" }).click();
  await expect(dialog.getByText("Status: review")).toBeVisible();
  expect((await products.get()).size).toBe(0);
  const confirm = dialog.getByRole("button", { name: "Konfirmasi dan simpan semua produk" });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByText("Harga wajib diisi")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("draft-review.png"), fullPage: true });
  await dialog.getByLabel("Harga Rupiah", { exact: true }).first().fill("125000");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Simpan koreksi draf" }).click();
  await expect(dialog.getByRole("button", { name: "Simpan koreksi draf" })).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(dialog.getByText("Status: confirmed")).toBeVisible();
  const saved = await products.get();
  expect(saved.size).toBe(2);
  expect(saved.docs.every(d => d.data().published === false)).toBe(true);
  expect(saved.docs.find(d => d.data().name === "Kemeja").data().price).toBe(125000);
  // Reload and resubmit exactly the same file: same receipt, no duplicate extraction/products.
  await page.reload();
  await expect(dialog.getByText("Status: confirmed")).toBeVisible();
  await dialog.getByLabel("Berkas katalog").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await dialog.getByRole("button", { name: "Unggah dan buat draf" }).click();
  await expect(dialog.getByText("Status: confirmed")).toBeVisible();
  expect((await products.get()).size).toBe(2);
  expect(ocr).toBe(1);
  await expect(dialog.getByRole("button", { name: "Unggah dan buat draf" })).toBeEnabled();
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
    return "Kemeja tanpa harga";
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
  await dialog.getByRole("button", { name: "Unggah dan buat draf" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Gunakan PDF/JPEG/PNG");
  await dialog.getByLabel("Berkas katalog").setInputFiles(fileURLToPath(new URL("../e2e/fixtures/photo.png", import.meta.url)));
  await dialog.getByRole("button", { name: "Unggah dan buat draf" }).click();
  await expect(dialog.getByText(/Target 5 detik terlewati/)).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText(/Status: failed/)).toBeVisible();
  await expect(dialog).not.toContainText("provider-secret-must-not-leak");
  fail = false;
  await dialog.getByRole("button", { name: "Unggah dan buat draf" }).click();
  await expect(dialog.getByText(/Status: review/)).toBeVisible();
  expect((await db.collection(`storefronts/${seller.uid}/products`).get()).size).toBe(0);
});
