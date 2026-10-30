import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { accounts, getDoc, listDocs, patchDoc, resetEmulators } from "./support/emulator.mjs";
import { buyerPage, ownerWithShop, prepare } from "./support/app.mjs";

/** A stand-in for Ollama Cloud's /api/chat, so no real model is ever called. */
let calls = [];
let server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      calls.push({ auth: req.headers.authorization, body });
      const system = body.messages[0].content;
      const id = /\[([^\]]+)\] Sambal Roa/.exec(system)?.[1];
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: { role: "assistant", content: JSON.stringify({ reply: "Sambal Roa harganya Rp 45.000. Untuk stok silakan chat penjual.", productIds: id ? [id] : [] }) }, done: true }));
    });
  });
  await new Promise((resolve) => server.listen(11499, "127.0.0.1", resolve));
});
test.afterAll(() => new Promise((resolve) => server.close(resolve)));
test.beforeEach(async () => {
  calls = [];
  await resetEmulators();
});

const askApi = (baseURL, slug, text) =>
  fetch(`${baseURL}/api/shop-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${Math.floor(Math.random() * 200)}` },
    body: JSON.stringify({ slug, messages: [{ role: "user", text }] }),
  });

test("shop assistant: opt-in, answers from the real catalog, stops when the trial ends", async ({ page, browser, baseURL }) => {
  const errors = await prepare(page);
  await ownerWithShop(page);
  const uid = (await accounts())["dewi@example.com"];
  const sambal = (await listDocs(`storefronts/${uid}/products`)).find((p) => p.name === "Sambal Roa");

  // off by default: no button, the API refuses, the model is not called
  const buyer = await buyerPage(browser, baseURL);
  await buyer.page.goto("/shop/dapur-dewi");
  await buyer.page.getByRole("heading", { name: "Dapur Dewi" }).waitFor();
  assert.equal(await buyer.page.getByRole("button", { name: "Tanya toko" }).count(), 0);
  assert.equal((await askApi(baseURL, "dapur-dewi", "halo")).status, 404);
  assert.equal(calls.length, 0);

  // the owner turns it on (passes the real rules)
  await page.goto("/catalog?store=edit");
  await page.getByRole("dialog").getByRole("switch", { name: "Asisten tanya-jawab otomatis" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").waitFor();
  assert.equal((await getDoc(`storefronts/${uid}`)).assistant, true);

  // a buyer asks; the reply and a product card come back
  await buyer.page.reload();
  await buyer.page.getByRole("button", { name: "Tanya toko" }).click();
  const sheet = buyer.page.getByRole("dialog", { name: "Tanya Dapur Dewi" });
  await sheet.getByLabel("Pertanyaan Anda").fill("Sambal roa berapa?");
  await sheet.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await sheet.getByText("Sambal Roa harganya Rp 45.000.", { exact: false }).waitFor();
  await sheet.getByRole("list", { name: "Produk yang disarankan" }).getByRole("button", { name: /Sambal Roa/ }).waitFor();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].auth, "Bearer test-key");
  const system = calls[0].body.messages[0].content;
  assert.match(system, new RegExp(`\\[${sambal.id}\\] Sambal Roa \\| Rp 45\\.000 \\| ready`));
  // the setup questionnaire and checkout choices, read through the public rules
  assert.ok(system.includes("PO, pengiriman dan retur: Pesan H-1. Antar sekitar Depok. Tidak bisa retur."), system);
  assert.ok(system.includes("Pilihan pembayaran saat memesan: Transfer bank") && system.includes('Sapa pembeli dengan "Kak"'), system);
  assert.match(system, /Kaos Polos \| Rp 80\.000 \| Ukuran: M \(Rp 80\.000\), L \(Rp 80\.000\)/);
  // cost (28.000 / 50.000) and stock (10 / 6) are private and never reach the model
  assert.equal(/28\.000|50\.000|stok \d/i.test(system), false, system);
  assert.deepEqual(calls[0].body.messages.at(-1), { role: "user", content: "Sambal roa berapa?" });

  // the trial ends: products are unreadable under the rules, so no model call
  await patchDoc(`entitlements/${uid}`, { trialStartedAt: new Date(Date.now() - 8 * 86_400_000) });
  const closed = await (await askApi(baseURL, "dapur-dewi", "masih buka?")).json();
  assert.equal(closed.closed, true);
  assert.equal(calls.length, 1, "model not called for a closed shop");

  // paid again, then the owner turns it off
  await patchDoc(`entitlements/${uid}`, { paidUntil: new Date(Date.now() + 30 * 86_400_000) });
  assert.equal((await askApi(baseURL, "dapur-dewi", "halo")).status, 200);
  await page.goto("/catalog?store=edit");
  await page.getByRole("dialog").getByRole("switch", { name: "Asisten tanya-jawab otomatis" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Simpan toko" }).click();
  await page.getByText("Pengaturan toko disimpan").waitFor();
  assert.equal((await askApi(baseURL, "dapur-dewi", "halo")).status, 404);

  assert.deepEqual(buyer.errors, []);
  await buyer.close();
  assert.deepEqual(errors, []);
});
