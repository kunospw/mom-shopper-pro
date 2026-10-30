/** Browser-side helpers for the emulator suite. */

/** Collects page errors and console errors (fonts and wa.me are stubbed). */
export async function prepare(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED|ERR_INTERNET_DISCONNECTED|non-existent route/.test(m.text()) && errors.push(m.text()));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "wa" }));
  return errors;
}

/**
 * Signs in with a Google account in the Auth emulator. Google's own popup page
 * is not under test (and needs apis.google.com), so the app's emulator-only
 * hook signs in with a Google credential; AuthContext then runs as in
 * production (profile created on first sign-in).
 */
export async function signIn(page, { name, email }) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Masuk dengan Google/ }).first().waitFor();
  await page.evaluate(([e, n]) => globalThis.__emulatorSignIn(e, n), [email, name]);
  // the app returns to the page the owner came from
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.goto("/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor({ timeout: 30_000 });
}

/** Signs out from Pengaturan → Akun. */
export async function signOut(page) {
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Keluar dari akun" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL(/\/login/);
}

/** Guided setup: opens a shop with a 7-day trial. */
export async function openShop(page, { name, whatsapp }) {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Buat toko" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mulai" }).click();
  await dialog.getByLabel("Nama toko").fill(name);
  await dialog.getByText("Tautan ini tersedia.").waitFor();
  await dialog.getByRole("button", { name: "Lanjut" }).click();
  await dialog.getByLabel("Nomor WhatsApp pesanan").fill(whatsapp);
  await dialog.getByRole("button", { name: "Lanjut" }).click();
  // One payment method and no delivery: buyers get it preselected, and the real rules check it.
  await dialog.getByLabel("Transfer bank").check();
  await dialog.getByRole("button", { name: "Lanjut" }).click();
  await dialog.getByLabel("Apa yang Anda jual?").fill("Sambal dan lauk rumahan, dibuat setiap hari.");
  await dialog.getByLabel("PO, pengiriman, dan retur").fill("Pesan H-1. Antar sekitar Depok. Tidak bisa retur.");
  await dialog.getByLabel("Jam balas chat").fill("Setiap hari 08.00-20.00");
  await dialog.getByRole("button", { name: "Lanjut" }).click();
  await dialog.getByRole("button", { name: "Lanjut ke pratinjau" }).click();
  await dialog.getByRole("button", { name: "Buka toko sekarang" }).click();
  await dialog.getByRole("heading", { name: "Toko Anda sudah buka!" }).waitFor();
  await page.keyboard.press("Escape");
}

/** Adds a ready product with tracked stock via the product slide-over. */
export async function addProduct(page, { name, price, cost, stock, options }) {
  await page.goto("/catalog?new=product");
  const sheet = page.getByRole("dialog", { name: "Tambah produk" });
  await sheet.getByLabel("Foto produk").setInputFiles(new URL("../../e2e/fixtures/photo.png", import.meta.url).pathname);
  await sheet.getByRole("img", { name: "Foto produk yang dipilih" }).waitFor();
  await sheet.getByLabel("Nama produk").fill(name);
  await sheet.getByLabel("Harga jual").fill(String(price));
  for (const [i, label] of (options ?? []).entries()) {
    await sheet.getByRole("button", { name: "Tambah pilihan" }).click();
    if (i === 0) await sheet.getByRole("button", { name: "Ukuran", exact: true }).click();
    await sheet.getByLabel(`Ukuran ${i + 1}`).fill(label);
  }
  await sheet.getByLabel("Modal per unit").fill(String(cost));
  if (stock != null) {
    await sheet.getByRole("switch", { name: "Hitung stok otomatis" }).click();
    await sheet.getByPlaceholder("Stok saat ini").fill(String(stock));
  }
  if ((await sheet.getByRole("switch", { name: "Tampilkan di katalog" }).getAttribute("aria-checked")) !== "true")
    await sheet.getByRole("switch", { name: "Tampilkan di katalog" }).click();
  await sheet.getByRole("button", { name: "Simpan produk" }).click();
  await page.getByText("Produk disimpan").waitFor();
}

/** A signed-out buyer orders products from a shop; returns the order id. */
export async function buyerOrders(page, slug, { buyer, items, note }) {
  await page.goto(`/shop/${slug}`);
  for (const { product, option } of items) {
    await page.getByRole("button", { name: new RegExp(`^Lihat ${product}`) }).click();
    if (option) await page.getByRole("button", { name: new RegExp(`^${option}`) }).click();
    await page.getByRole("button", { name: /^Tambah · / }).click();
  }
  await page.getByRole("button", { name: /Lihat pesanan/ }).click();
  await page.getByLabel("Nama Anda").fill(buyer);
  await page.getByLabel("Nomor WhatsApp").fill("081234567890");
  if (note) await page.getByLabel(/Catatan untuk penjual/).fill(note);
  await page.getByRole("button", { name: "Kirim pesanan via WhatsApp" }).click();
  await page.getByRole("heading", { name: "Pesanan tersimpan" }).waitFor();
  await page.getByRole("link", { name: "Lacak status pesanan" }).click();
  await page.waitForURL(/\/order\//);
  return page.url().split("/order/")[1];
}

/** A signed-in owner with an open shop and two stocked products. */
export async function ownerWithShop(page, { name = "Dewi Lestari", email = "dewi@example.com", shop = "Dapur Dewi" } = {}) {
  await signIn(page, { name, email });
  await openShop(page, { name: shop, whatsapp: "0812 1111 2222" });
  await addProduct(page, { name: "Sambal Roa", price: 45000, cost: 28000, stock: 10 });
  await addProduct(page, { name: "Kaos Polos", price: 80000, cost: 50000, stock: 6, options: ["M", "L"] });
}

/** A separate, signed-out browser context (a buyer on their own phone). */
export async function buyerPage(browser, baseURL) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = await prepare(page);
  return { page, errors, close: () => ctx.close() };
}
