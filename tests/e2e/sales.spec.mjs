import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { seedSource } from "./support/seed.mjs";
const B = "http://localhost:8099";
for (const [w, h, tag] of [[1440, 1000, "desktop"], [390, 844, "mobile"]]) {
  test(`Penjualan: slide-over, detail, pembayaran, pengembalian · ${tag}`, async ({ browser }, info) => {
    test.skip(info.project.name !== (w < 800 ? "phone" : "desktop"), "covered by the other project");
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`${B}/`);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${B}/`);
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    await page.evaluate(seedSource);
    await page.reload();
    await page.getByRole("heading", { name: /Halo/ }).waitFor();
    const paid = await page.evaluate(() => globalThis.__db.sales.find((s) => s.customer.name === "Dewi Anggraini" && s.paymentState === "paid"));
    await page.goto(`${B}/sales?view=${paid.id}`);
    await page.getByRole("heading", { name: new RegExp(paid.number) }).waitFor();
    // over-refund is refused
    await page.getByRole("button", { name: "Catat pengembalian dana" }).click();
    await page.getByLabel("Jumlah dikembalikan").fill(String(paid.total + 1000));
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "tidak boleh melebihi" }).waitFor();
    // partial refund recorded as a return (revenue down, balance unchanged)
    await page.getByLabel("Jumlah dikembalikan").fill("45000");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.getByRole("dialog").getByText(/Pengembalian dana/).first().waitFor();
    const after = await page.evaluate((id) => globalThis.__db.sales.find((s) => s.id === id), paid.id);
    const refund = after.payments.find((p) => p.kind === "refund");
    assert.equal(refund.amount, 45000);
    assert.equal(refund.reason, "return");
    assert.equal(after.balance, 0, "a return does not reopen the receivable");
    // cancel, then refund the rest as a cancellation
    await page.getByRole("button", { name: "Tindakan lain" }).click();
    await page.getByRole("menuitem", { name: /Batalkan penjualan/ }).click();
    await page.getByRole("dialog").getByText("Perlu dikembalikan").first().waitFor();
    await page.getByRole("button", { name: "Catat pengembalian dana" }).click();
    assert.equal((await page.getByLabel("Jumlah dikembalikan").inputValue()).replace(/\D/g, ""), String(paid.total - 45000), "prefilled with what is still held");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForFunction((id) => globalThis.__db.sales.find((s) => s.id === id).payments.filter((p) => p.kind === "refund").length === 2, paid.id);
    const last = await page.evaluate((id) => globalThis.__db.sales.find((s) => s.id === id), paid.id);
    assert.equal(last.payments.at(-1).reason, "cancellation");
    assert.equal(last.refundDue, 0);
    // list: stats, filters, month picker
    await page.goto(`${B}/sales`);
    await page.getByRole("region", { name: "Ringkasan bulan ini" }).waitFor();
    await page.getByRole("button", { name: /^Belum lunas/ }).click();
    const shownDue = await page.getByText(/^Menampilkan \d+ penjualan/).innerText();
    const due = await page.evaluate(() => globalThis.__db.sales.filter((s) => s.fulfillment.status !== "cancelled" && s.balance > 0).length);
    assert.equal(shownDue, `Menampilkan ${due} penjualan`);
    const months = await page.locator("#sales-month option").count();
    assert(months >= 6, "month options");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "overflow " + tag);
    assert.deepEqual(errors, []);
    console.log("PASS", tag);
  });
}
