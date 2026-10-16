import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function bundle(file) {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(`../${file}`, import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm",
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
const setup = await bundle("src/lib/store-setup.ts");
const { slugSchema } = await bundle("src/lib/catalog.ts");

// ---- link suggestion from the shop name ----
assert.equal(setup.suggestSlug("Toko Bunda Rina!"), "toko-bunda-rina");
assert.equal(setup.suggestSlug("  Faeza Store  "), "faeza-store");
assert.equal(setup.suggestSlug("Kue & Kopi"), "kue-dan-kopi");
assert.equal(setup.suggestSlug("Café Ölé"), "cafe-ole", "accents removed");
assert.equal(setup.suggestSlug("ab"), "", "too short");
assert.equal(setup.suggestSlug("!!!"), "");
assert.equal(setup.suggestSlug("admin"), "admin-toko", "reserved name gets a suffix");
assert.equal(setup.suggestSlug("shop"), "shop-toko");
const long = setup.suggestSlug("Toko Perlengkapan Bayi dan Anak Bunda Sejahtera");
assert.ok(long.length <= 30 && !long.endsWith("-"), long);
for (const name of ["Toko Bunda Rina!", "Kue & Kopi", "admin", "Toko Perlengkapan Bayi dan Anak Bunda Sejahtera", "123 Snack"])
  assert.ok(slugSchema.safeParse(setup.suggestSlug(name)).success, `valid slug for ${name}`);

// ---- WhatsApp normalization ----
assert.equal(setup.toWhatsApp("0812 3456 7890"), "6281234567890");
assert.equal(setup.toWhatsApp("+62 812-3456-7890"), "6281234567890");
assert.equal(setup.toWhatsApp("62 812 3456 7890"), "6281234567890");
assert.equal(setup.toWhatsApp("812 3456 7890"), "6281234567890");
assert.equal(setup.toWhatsApp("(0812) 3456-7890"), "6281234567890");
assert.equal(setup.toWhatsApp("6281234567890"), "6281234567890", "stored format unchanged");
assert.equal(setup.toWhatsApp("+60 12-345 6789"), "60123456789", "other countries kept");
assert.equal(setup.toWhatsApp(""), "");
assert.equal(setup.toWhatsApp("abc"), "");
assert.ok(setup.whatsAppPattern.test(setup.toWhatsApp("0812 3456 7890")));
assert.ok(!setup.whatsAppPattern.test(setup.toWhatsApp("0812")), "too short rejected");
assert.ok(!setup.whatsAppPattern.test(setup.toWhatsApp("0")), "zero only rejected");

// ---- display ----
assert.equal(setup.formatWhatsApp("6281234567890"), "+62 812-3456-7890");
assert.equal(setup.formatWhatsApp("60123456789"), "+60123456789");
assert.equal(setup.formatWhatsApp("123"), "123", "invalid shown as typed");

// ---- description ideas fit the schema ----
for (const idea of setup.descriptionIdeas) assert.ok(idea.text.length <= 600 && idea.label);

console.log("PASS: store setup helpers (link suggestion, WhatsApp normalization, display)");
