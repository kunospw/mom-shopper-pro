import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { freshApp, noHorizontalOverflow, patchDb, readDb } from "./support/helpers.mjs";

/** Stubs /api/shop-chat; `answer` maps the request body to [status, json]. */
async function stubChat(page, answer) {
  const requests = [];
  await page.route("**/api/shop-chat", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const [status, json] = await answer(body, requests.length);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  });
  return requests;
}

test.describe("Asisten toko", () => {
  test("hidden until the owner turns it on; the owner switch saves", async ({ page }) => {
    const errors = await freshApp(page);
    await page.goto("/shop/tokomelati");
    await page.getByRole("heading", { name: "Toko Melati" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Tanya toko" }).count(), 0, "off by default");

    await page.goto("/catalog?store=edit");
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Menjawab pertanyaan pembeli dari katalog Anda dan info toko", { exact: false }).waitFor();
    await dialog.getByRole("switch", { name: "Asisten tanya-jawab otomatis" }).click();
    // the assistant answers from the setup questionnaire, so it must be complete first
    await dialog.getByRole("button", { name: "Simpan toko" }).click();
    await dialog.getByText("Lengkapi info toko supaya asisten bisa menjawab pembeli.", { exact: false }).waitFor();
    await dialog.getByLabel("Apa yang Anda jual?").fill("Pakaian linen dan tas rajut buatan sendiri.");
    await dialog.getByLabel("PO, pengiriman, dan retur").fill("Tas rajut PO 7 hari. Tukar ukuran 3 hari.");
    await dialog.getByLabel("Jam balas chat").fill("Senin-Sabtu 09.00-17.00");
    await dialog.getByRole("button", { name: "Bunda" }).click();
    await dialog.getByRole("button", { name: "Simpan toko" }).click();
    await page.getByText("Pengaturan toko disimpan").waitFor();
    const savedStore = (await readDb(page)).store;
    assert.equal(savedStore.assistant, true);
    assert.deepEqual(savedStore.profile, { products: "Pakaian linen dan tas rajut buatan sendiri.", policies: "Tas rajut PO 7 hari. Tukar ukuran 3 hari.", hours: "Senin-Sabtu 09.00-17.00", greeting: "Bunda" });

    await page.goto("/shop/tokomelati");
    await page.getByRole("button", { name: "Tanya toko" }).waitFor();
    assert.deepEqual(errors, []);
  });

  test("ask, get an answer with product cards, open a product, hand off to WhatsApp", async ({ page }, info) => {
    const errors = await freshApp(page);
    await patchDb(page, `d.store.assistant = true;`);
    const requests = await stubChat(page, (body, n) =>
      n === 1
        ? [200, { reply: "Kemeja Linen ada warna Hitam dan Putih. Untuk stok, silakan chat penjual ya.", productIds: ["p1", "tidak-ada"] }]
        : [200, { reply: "Voucher Game berupa produk digital.", productIds: ["p2"] }],
    );
    await page.goto("/shop/tokomelati");
    await page.getByRole("button", { name: "Tanya toko" }).click();
    const sheet = page.getByRole("dialog", { name: "Tanya Toko Melati" });
    await sheet.getByText("Asisten otomatis · menjawab dari katalog toko").waitFor();
    await sheet.getByText(/Halo! Saya asisten otomatis Toko Melati/).waitFor();
    await page.waitForTimeout(400);
    await noHorizontalOverflow(page, "assistant open");
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
    assert.deepEqual(serious, []);

    // a starter chip asks right away
    await sheet.getByRole("button", { name: "Ada pilihan ukuran apa saja?" }).click();
    const log = sheet.getByRole("log", { name: "Percakapan" });
    await log.getByText("Kemeja Linen ada warna Hitam dan Putih.", { exact: false }).waitFor();
    assert.deepEqual(requests[0], { slug: "tokomelati", messages: [{ role: "user", text: "Ada pilihan ukuran apa saja?" }] });
    const cards = log.getByRole("list", { name: "Produk yang disarankan" });
    assert.equal(await cards.getByRole("button").count(), 1, "unknown product id dropped");
    await cards.getByRole("button", { name: /Kemeja Linen/ }).getByText("mulai Rp").waitFor();

    // a typed follow-up sends the history
    await sheet.getByLabel("Pertanyaan Anda").fill("Kalau voucher bagaimana?");
    await sheet.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await log.getByText("Voucher Game berupa produk digital.").waitFor();
    assert.deepEqual(requests[1].messages.map((m) => m.role), ["user", "assistant", "user"]);
    assert.equal(requests[1].messages[2].text, "Kalau voucher bagaimana?");

    // WhatsApp hand-off is always there
    assert.equal(await sheet.getByRole("link", { name: "Chat penjual" }).getAttribute("href"), "https://wa.me/6281234567890");

    // history survives a reload; a card opens the product page
    await page.reload();
    await page.getByRole("button", { name: "Tanya toko" }).click();
    await log.getByText("Voucher Game berupa produk digital.").waitFor();
    await log.getByRole("button", { name: /Kemeja Linen/ }).click();
    await page.waitForURL(/product=p1/);
    await page.getByRole("heading", { level: 1, name: "Kemeja Linen" }).waitFor();
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/assistant-${info.project.name}.png` });
    assert.deepEqual(errors, []);
  });

  test("errors, rate limit and an assistant turned off stay friendly", async ({ page }) => {
    const errors = await freshApp(page);
    await patchDb(page, `d.store.assistant = true;`);
    // put something in the cart: the button moves above the cart bar
    await page.goto("/shop/tokomelati");
    await page.getByRole("button", { name: /^Lihat Voucher Game/ }).click();
    await page.getByRole("button", { name: /^Tambah · / }).click();
    const ask = page.getByRole("button", { name: "Tanya toko" });
    const cartBar = page.getByRole("button", { name: /Lihat pesanan/ });
    const [a, c] = [await ask.boundingBox(), await cartBar.boundingBox()];
    assert.ok(a.y + a.height <= c.y, "assistant button sits above the cart bar");

    const replies = [
      [200, { reply: "Maaf, asisten sedang tidak bisa menjawab. Silakan chat penjual lewat WhatsApp ya.", productIds: [], fallback: true }],
      [429, { error: "rate-limited" }],
      [500, { error: "x" }],
      [404, { error: "assistant-off" }],
    ];
    await stubChat(page, (_b, n) => replies[n - 1]);
    await ask.click();
    const sheet = page.getByRole("dialog", { name: "Tanya Toko Melati" });
    const send = async (text) => {
      await sheet.getByLabel("Pertanyaan Anda").fill(text);
      await sheet.getByLabel("Pertanyaan Anda").press("Enter");
    };
    await send("satu");
    await sheet.getByText("Maaf, asisten sedang tidak bisa menjawab.", { exact: false }).waitFor();
    await send("dua");
    await sheet.getByText(/Coba lagi beberapa menit lagi/).waitFor();
    await send("tiga");
    await sheet.getByText("Maaf, pertanyaan belum terkirim. Coba lagi.").waitFor();
    await send("empat");
    await sheet.getByText("Asisten sedang tidak aktif.", { exact: false }).waitFor();
    // empty and over-long input
    await sheet.getByLabel("Pertanyaan Anda").fill("   ");
    assert.equal(await sheet.getByRole("button", { name: "Kirim pertanyaan" }).isDisabled(), true);
    await sheet.getByLabel("Pertanyaan Anda").fill("x".repeat(600));
    assert.equal((await sheet.getByLabel("Pertanyaan Anda").inputValue()).length, 500);
    // offline
    await page.context().setOffline(true);
    await page.unroute("**/api/shop-chat");
    await sheet.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await sheet.getByText("Koneksi terputus.", { exact: false }).waitFor();
    await page.context().setOffline(false);
    assert.deepEqual(errors.filter((e) => !/Failed to load resource|429|500|404/.test(e)), []);
  });
});
