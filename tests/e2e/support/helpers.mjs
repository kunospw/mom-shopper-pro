import assert from "node:assert/strict";
import { seedSource } from "./seed.mjs";

/** Fresh mocked app: empty storage, Google Fonts and wa.me stubbed, console errors collected. */
export async function freshApp(page, { seed = false } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "wa" }));
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/");
  await page.getByRole("heading", { name: /Halo/ }).waitFor();
  if (seed) {
    await page.evaluate(seedSource);
    await page.reload();
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
  }
  return errors;
}

/** Runs a change against the in-page mock database and persists it. */
export const patchDb = (page, source) =>
  page.evaluate((s) => {
    const d = globalThis.__db;
    new Function("d", s)(d);
    localStorage.setItem("__mockdb_v1", JSON.stringify(d));
  }, source);

export const readDb = (page) => page.evaluate(() => globalThis.__db);

export async function noHorizontalOverflow(page, label = "") {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(extra <= 0, `horizontal overflow ${extra}px ${label}`);
}

/** Workspace pages and the heading each one shows. */
export const workspacePages = [
  { path: "/", heading: /Halo/ },
  { path: "/orders", heading: "Pesanan masuk" },
  { path: "/sales", heading: "Penjualan" },
  { path: "/customers", heading: "Pelanggan" },
  { path: "/catalog", heading: "Katalog" },
  { path: "/promote", heading: "Promosi" },
  { path: "/costs", heading: "Pembelian & biaya" },
  { path: "/reports", heading: "Laporan" },
  { path: "/settings/appearance", heading: "Pengaturan" },
  { path: "/settings/business", heading: "Pengaturan" },
  { path: "/settings/payments", heading: "Pengaturan" },
  { path: "/settings/plan", heading: "Pengaturan" },
  { path: "/settings/account", heading: "Pengaturan" },
];
