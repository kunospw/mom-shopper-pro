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
const plan = await bundle("src/lib/plan-config.ts");
const promo = await bundle("src/lib/promo.ts");
const { planState } = await bundle("src/lib/entitlement.ts");

// ---- price and WhatsApp config ----
assert.equal(plan.parsePrice(undefined), 49000, "default price");
assert.equal(plan.parsePrice(""), 49000);
assert.equal(plan.parsePrice("99000"), 99000);
assert.equal(plan.parsePrice("Rp 59.000"), 59000);
assert.equal(plan.parsePrice("0"), 0, "0 hides the price");
assert.equal(plan.parsePrice("abc"), 0);
assert.equal(plan.parseWhatsApp(undefined), "6281298590798", "default upgrade number");
assert.equal(plan.parseWhatsApp("+62 812-9859-0798"), "6281298590798");
assert.equal(plan.parseWhatsApp("081298590798"), null, "leading 0 is not a valid wa.me number");
assert.equal(plan.parseWhatsApp("javascript:alert(1)"), null);
assert.equal(plan.PLAN_PRICE_IDR, 49000);
assert.equal(plan.UPGRADE_WHATSAPP, "6281298590798");

// ---- upgrade message ----
const now = new Date("2026-11-10T05:00:00Z");
const trial = planState({ trialStartedAt: new Date(now.getTime() - 5 * 86400000).toISOString(), paidUntil: null }, now, null);
const text = plan.upgradeMessage({ shopName: "Toko Bu Sari", email: "sari@x.id", uid: "abcdefgh12345", plan: trial });
assert(text.includes("Rp 49.000/bulan") && text.includes("Toko Bu Sari") && text.includes("sari@x.id"), text);
assert(text.includes("Kode akun: abcdefgh"), "account code for the operator");
assert(text.includes("Uji coba berakhir"), text);
const url = new URL(plan.upgradeLink(text));
assert.equal(url.host + url.pathname, "wa.me/6281298590798");
assert.equal(url.searchParams.get("text"), text);
assert.equal(plan.upgradeLink(text, null), null, "no number, no link");
assert.match(plan.planLine(planState(null, now, null)), /Belum memulai/);
assert.match(plan.planLine(planState({ trialStartedAt: "2026-01-01T00:00:00Z", paidUntil: null }, now, null)), /berakhir/);

// ---- broadcast ----
const store = { id: "u1", slug: "bu-sari", name: "Toko Bu Sari", accent: "forest" };
const mk = (id, over = {}) => ({ id, name: id, description: "", category: "", price: 50000, image: "", availability: "ready", leadTime: "", optionLabel: "Ukuran", options: [], kind: "physical", published: true, ...over });
const products = [
  mk("gamis", { name: "Gamis Rayon", options: [{ label: "S", price: 179000 }, { label: "L", price: 199000 }] }),
  mk("ebook", { name: "E-book MPASI", price: 35000, kind: "digital" }),
  mk("mukena", { name: "Mukena", price: 165000, availability: "preorder", leadTime: "7 hari" }),
  mk("madu", { name: "Madu", availability: "unavailable" }),
  mk("draft", { name: "Draft", published: false }),
];
const origin = "https://x.test";
const msg = promo.buildBroadcast({ store, products, template: "promo", headline: "Diskon 10%", note: "Gratis ongkir Bekasi", origin });
assert(msg.startsWith("🎉 Promo spesial dari Toko Bu Sari!"), msg);
assert(msg.includes("Diskon 10%") && msg.includes("Gratis ongkir Bekasi"));
assert(msg.includes("• Gamis Rayon — Rp 179.000 – 199.000"), "price range");
assert(msg.includes("• E-book MPASI — Rp 35.000 (digital)"));
assert(msg.includes("• Mukena — Rp 165.000 (PO 7 hari)"));
assert(!msg.includes("Madu") && !msg.includes("Draft"), "unavailable and hidden products are left out");
assert(msg.includes("https://x.test/shop/bu-sari?product=gamis"), "per-product link");
assert(msg.endsWith("🛍️ Lihat katalog: https://x.test/shop/bu-sari"));
for (const t of promo.promoTemplates) {
  const m = promo.buildBroadcast({ store, products, template: t.id, origin });
  assert(m.includes("Lihat katalog") && m.split("\n\n").length >= 4, t.id);
  assert(!m.includes("\n\n\n"), "no empty blocks when headline/note are blank");
}
const many = Array.from({ length: 9 }, (_, i) => mk(`p${i}`, { name: `Produk ${i}` }));
assert.equal((promo.buildBroadcast({ store, products: many, template: "new", origin }).match(/^• /gm) || []).length, promo.MAX_PROMO_PRODUCTS, "6-product cap");
assert.equal(promo.shopLink({ id: "uid-1", slug: "" }, origin), "https://x.test/shop/uid-1", "falls back to the id");

// ---- status and bio ----
const short = promo.statusText({ store, products, template: "new", origin });
assert(!short.includes("?product="), "status version has no per-product links");
const long = promo.statusText({ store, products: many.map((p) => ({ ...p, name: p.name + " ".repeat(1) + "x".repeat(90) })), template: "new", note: "y".repeat(300), origin });
assert(long.length <= promo.STATUS_LIMIT, `status capped (${long.length})`);
assert(long.endsWith("https://x.test/shop/bu-sari"), "shop link survives the cut");
const bio = promo.bioText(store, origin);
assert(bio.length <= 139 && bio.includes("x.test/shop/bu-sari") && !bio.includes("https://"), bio);
console.log("plan config, upgrade message, broadcast templates, status cap, bio: PASS");
