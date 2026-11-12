import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { accounts, getDoc, listDocs, resetEmulators } from "./support/emulator.mjs";
import { buyerOrders, buyerPage, ownerWithShop, prepare, signIn } from "./support/app.mjs";

test.beforeEach(resetEmulators);

test("deleting the account removes the books, the shop, orders and buyer contacts under the real rules", async ({ page, browser, baseURL }) => {
  await prepare(page);
  await ownerWithShop(page);
  const uid = (await accounts())["dewi@example.com"];
  const buyer = await buyerPage(browser, baseURL);
  const orderId = await buyerOrders(buyer.page, "dapur-dewi", { buyer: "Siti", items: [{ product: "Sambal Roa" }] });
  const orderPath = `storefronts/${uid}/orders/${orderId}`;
  assert.ok(await getDoc(`${orderPath}/contact/buyer`), "buyer contact stored");
  assert.equal((await listDocs(`users/${uid}/inventory`)).length, 2);

  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Hapus akun dan data" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Hapus akun dan semua data?" });
  await dialog.getByLabel("Ketik HAPUS untuk melanjutkan").fill("HAPUS");
  await dialog.getByRole("button", { name: "Hapus permanen" }).click();
  await page.waitForURL(/\/login/, { timeout: 60_000 });

  assert.equal((await accounts())["dewi@example.com"], undefined, "Auth account deleted");
  for (const path of [`users/${uid}`, `storefronts/${uid}`, "slugs/dapur-dewi", orderPath, `${orderPath}/contact/buyer`])
    assert.equal(await getDoc(path), null, `${path} deleted`);
  for (const path of [`users/${uid}/inventory`, `users/${uid}/sales`, `users/${uid}/meta`, `storefronts/${uid}/products`, `storefronts/${uid}/orders`])
    assert.deepEqual(await listDocs(path), [], `${path} empty`);
  // The trial record stays so the free trial cannot be restarted.
  assert.ok((await getDoc(`entitlements/${uid}`)).trialStartedAt instanceof Date);

  // The shop link and the buyer's tracking link are gone.
  await buyer.page.goto("/shop/dapur-dewi");
  await buyer.page.getByText("Ditenagai LarisKu").waitFor();
  assert.equal(await buyer.page.getByRole("heading", { name: "Dapur Dewi" }).count(), 0);
  await buyer.close();

  // Signing in again starts a brand-new, empty account.
  await signIn(page, { name: "Dewi Lestari", email: "dewi@example.com" });
  const again = (await accounts())["dewi@example.com"];
  assert.ok(again && again !== uid, "new account id");
  await page.getByText("Belum ada transaksi. Catat penjualan pertama Anda.").waitFor();
});
