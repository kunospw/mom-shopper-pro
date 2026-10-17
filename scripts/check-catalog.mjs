import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: [
    fileURLToPath(new URL("../src/lib/catalog.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const model = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const {
  productSchema,
  storefrontSchema,
  readProduct,
  readStorefront,
  reconcileCart,
  cartTotal,
  whatsAppOrder,
  orderSignature,
  normalizeWhatsApp,
  optionPrice,
  orderItems,
  orderRequestSchema,
  orderCode,
  readOrder,
  orderShopSnapshot,
  slugSchema,
  MAX_ORDER_LINES,
} = model;
const store = {
  id: "seller-a",
  name: "Toko & Melati",
  description: "Produk pilihan",
  whatsapp: "6281234567890",
  accent: "teal",
  logo: "",
  published: true,
  slug: "",
};
const product = {
  id: "ready",
  name: "Kemeja & linen",
  description: "Nyaman",
  category: "Pakaian",
  price: 150000,
  image: "",
  availability: "ready",
  leadTime: "",
  optionLabel: "Warna",
  options: [
    { label: "Hitam", price: 0 },
    { label: "Putih", price: 160000 },
  ],
  kind: "physical",
  published: true,
};
const { id: productId, ...fields } = product;
assert(productSchema.safeParse(fields).success);
for (const change of [
  { price: -1 },
  { price: 1.5 },
  { price: NaN },
  { image: "data:image/svg+xml;base64,AAA=" },
  { availability: "maybe" },
  { availability: "preorder", leadTime: "" },
  { options: [{ label: "A", price: 0 }, { label: "A", price: 5 }] },
  { options: Array(9).fill({ label: "A", price: 0 }) },
  { options: ["A"] },
  { options: [{ label: "A", price: -1 }] },
  { options: [{ label: "A", price: 1.5 }] },
  { kind: "service" },
  { basePrice: 50000 },
])
  assert.equal(
    productSchema.safeParse({ ...fields, ...change }).success,
    false,
  );
const { id: storeId, ...shopFields } = store;
assert.equal(
  storefrontSchema.safeParse({ ...shopFields, whatsapp: "javascript:alert(1)" })
    .success,
  false,
);
assert.equal(
  storefrontSchema.safeParse({ ...shopFields, name: " ", published: true })
    .success,
  false,
);
assert.equal(
  storefrontSchema.safeParse({ ...shopFields, whatsapp: "", published: true })
    .success,
  false,
);
assert.equal(
  storefrontSchema.safeParse({
    ...shopFields,
    whatsapp: "",
    name: "",
    published: false,
  }).success,
  true,
);
assert.equal(normalizeWhatsApp("+62 (812) 345-678"), "62812345678");
assert.equal(
  "basePrice" in
    readProduct(productId, { ...fields, basePrice: 123, buyerName: "Private" }),
  false,
);
assert.equal(
  "email" in
    readStorefront(storeId, { ...shopFields, email: "private@example.test" }),
  false,
);
const preorder = {
  ...product,
  id: "preorder",
  name: "Tas rajut",
  options: [],
  price: 200000,
  availability: "preorder",
  leadTime: "7–10 hari",
};
const draft = { ...product, id: "draft", published: false };
const paused = { ...product, id: "paused", availability: "unavailable" };
const products = [product, preorder, draft, paused];
const lines = [
  { productId: "ready", option: "Hitam", quantity: 2 },
  { productId: "preorder", option: "", quantity: 1 },
];
assert.deepEqual(
  reconcileCart(
    [
      ...lines,
      { productId: "draft", option: "Hitam", quantity: 1 },
      { productId: "paused", option: "Hitam", quantity: 1 },
      { productId: "ready", option: "Invalid", quantity: 1 },
      { productId: "ready", option: "Putih", quantity: 0 },
      { productId: "ready", option: "Putih", quantity: 1.2 },
      { productId: "ready", option: "Putih", quantity: "3" },
    ],
    products,
  ),
  lines,
);
assert.deepEqual(
  reconcileCart(
    [
      { productId: "ready", option: "Hitam", quantity: 98 },
      { productId: "ready", option: "Hitam", quantity: 4 },
    ],
    products,
  ),
  [{ productId: "ready", option: "Hitam", quantity: 99 }],
);
assert.equal(cartTotal(lines, products), 500000);
assert.equal(
  cartTotal(
    lines,
    products.map((item) =>
      item.id === "ready" ? { ...item, price: 175000 } : item,
    ),
  ),
  550000,
);
const url = new URL(whatsAppOrder(store, products, lines));
assert.equal(url.origin, "https://wa.me");
assert.equal(url.pathname, "/6281234567890");
const text = url.searchParams.get("text");
for (const expected of [
  "Kemeja & linen",
  "Warna: Hitam",
  "Preorder",
  "7–10 hari",
  "belum pembayaran",
  "belum termasuk ongkir",
])
  assert(text.includes(expected));
assert.throws(() =>
  whatsAppOrder({ ...store, published: false }, products, lines),
);
assert.throws(() =>
  whatsAppOrder(store, products, [
    { productId: "draft", option: "Hitam", quantity: 1 },
  ]),
);
assert.notEqual(
  orderSignature(store, products, lines),
  orderSignature(
    store,
    products.map((item) => ({ ...item, price: item.price + 1 })),
    lines,
  ),
);
assert.equal(
  orderSignature(store, products, lines),
  orderSignature(
    store,
    products.map((item) => ({ ...item, image: "changed" })),
    lines,
  ),
);
assert.deepEqual(reconcileCart(JSON.parse('{"private":true}'), products), []);

// option prices: an option with price 0 uses the base price
assert.equal(optionPrice(product, "Hitam"), 150000);
assert.equal(optionPrice(product, "Putih"), 160000);
assert.equal(
  cartTotal([{ productId: "ready", option: "Putih", quantity: 2 }], products),
  320000,
);
assert.notEqual(
  orderSignature(store, products, [{ productId: "ready", option: "Putih", quantity: 1 }]),
  orderSignature(
    store,
    products.map((item) =>
      item.id === "ready"
        ? { ...item, options: item.options.map((o) => (o.label === "Putih" ? { ...o, price: 170000 } : o)) }
        : item,
    ),
    [{ productId: "ready", option: "Putih", quantity: 1 }],
  ),
);
// legacy listings stored options as plain strings and had no kind
const legacy = readProduct("old", { ...fields, options: ["Hitam", "Putih"], kind: undefined });
assert.deepEqual(legacy.options, [
  { label: "Hitam", price: 0 },
  { label: "Putih", price: 0 },
]);
assert.equal(legacy.kind, "physical");
// slugs
for (const ok of ["tokobunda", "toko-bunda-2", "abc"]) assert(slugSchema.safeParse(ok).success, ok);
for (const bad of ["ab", "-abc", "abc-", "Abc", "a_b", "admin", "x".repeat(31), "toko bunda"])
  assert.equal(slugSchema.safeParse(bad).success, false, bad);
assert.equal(readStorefront(storeId, { ...shopFields, slug: undefined }).slug, "");
// order snapshot freezes what the buyer saw
const snapshot = orderItems(products, [{ productId: "ready", option: "Putih", quantity: 2 }, { productId: "preorder", option: "", quantity: 1 }]);
assert.deepEqual(snapshot[0], { productId: "ready", name: "Kemeja & linen", option: "Putih", kind: "physical", unitPrice: 160000, quantity: 2, availability: "ready", leadTime: "" });
assert.equal(snapshot[1].leadTime, "7–10 hari");
assert(orderRequestSchema.safeParse({ buyerName: "Siti", note: "", items: snapshot }).success);
for (const bad of [
  { buyerName: " ", note: "", items: snapshot },
  { buyerName: "Siti", note: "x".repeat(301), items: snapshot },
  { buyerName: "Siti", note: "", items: [] },
  { buyerName: "Siti", note: "", items: Array(MAX_ORDER_LINES + 1).fill(snapshot[0]) },
  { buyerName: "Siti", note: "", items: [{ ...snapshot[0], unitPrice: 0 }] },
  { buyerName: "Siti", note: "", items: [{ ...snapshot[0], extra: 1 }] },
  { buyerName: "Siti", note: "", items: snapshot, status: "confirmed" },
])
  assert.equal(orderRequestSchema.safeParse(bad).success, false);
// the cart cannot hold more distinct lines than the order rules accept
const many = Array.from({ length: 12 }, (_, i) => ({ ...product, id: `p${i}`, options: [] }));
assert.equal(
  reconcileCart(many.map((p) => ({ productId: p.id, option: "", quantity: 1 })), many).length,
  MAX_ORDER_LINES,
);
// order message carries the code and status link
const placed = new URL(
  whatsAppOrder(store, products, lines, { id: "abcdef123456", buyerName: "Siti", statusUrl: "https://x.test/shop/toko/order/abcdef123456" }),
).searchParams.get("text");
assert(placed.includes("#ABCDEF") && placed.includes("Siti") && placed.includes("https://x.test/shop/toko/order/abcdef123456"));
assert.equal(orderCode("abcdef123456"), "ABCDEF");
// a stored order round-trips and rejects malformed progress
const stored = readOrder("o1", { status: "confirmed", progress: "shipped", buyerName: "Siti", note: "", items: snapshot, subtotal: 520000, trackingNo: "JNE1", sellerNote: "" });
assert.equal(stored.progress, "shipped");
assert.throws(() => readOrder("o1", { status: "hacked", progress: "x", buyerName: "Siti", note: "", items: snapshot }));
for (const accent of ["forest", "teal", "blue", "violet"])
  assert(storefrontSchema.safeParse({ ...shopFields, accent }).success, accent);
for (const accent of ["pink", "", "Forest", undefined])
  assert.equal(storefrontSchema.safeParse({ ...shopFields, accent }).success, false, String(accent));
console.log(
  "PASS: listing/store validation, option prices, legacy options, slugs, order snapshots, public projections, cart tampering and reconciliation, WhatsApp encoding and unpublished-order rejection.",
);

// ---- order snapshot and progress timestamps (tracking must not need the storefront) ----
{
  const stamp = (iso) => ({ toDate: () => new Date(iso) });
  const withSnapshot = readOrder("o2", {
    status: "confirmed", progress: "packed", buyerName: "Siti", note: "", items: snapshot, subtotal: 520000,
    trackingNo: "", sellerNote: "",
    shop: { name: "Toko A", whatsapp: "6281234567890", slug: "toko-a" },
    steps: { confirmed: stamp("2026-10-01T03:00:00Z"), packed: stamp("2026-10-02T04:00:00Z"), bogus: stamp("2026-10-03T00:00:00Z") },
  });
  assert.deepEqual(withSnapshot.shop, { name: "Toko A", whatsapp: "6281234567890", slug: "toko-a" });
  assert.deepEqual(withSnapshot.steps, { confirmed: "2026-10-01T03:00:00.000Z", packed: "2026-10-02T04:00:00.000Z" });
  assert.equal(orderShopSnapshot({ name: "T", whatsapp: "62812345678", slug: "" , extra: 1 }).extra, undefined);
  // orders created before the snapshot existed still read
  const legacy = readOrder("o3", { status: "pending", progress: "pending", buyerName: "Lama", note: "", items: snapshot, subtotal: 1 });
  assert.equal(legacy.shop, null);
  assert.deepEqual(legacy.steps, {});
  // a malformed snapshot is ignored rather than trusted
  assert.equal(readOrder("o4", { status: "pending", progress: "pending", buyerName: "X", note: "", items: snapshot, shop: { name: 5 } }).shop, null);
  console.log("order snapshot and steps parsing: PASS");
}

// ---- WhatsApp message comes from the saved order, short option prices ----
{
  const { orderMessage, whatsAppLink, shortRupiah } = model;
  const message = orderMessage(
    {
      id: "k7q2mdabc", buyerName: "Ayu Lestari", note: "Kirim Minggu", subtotal: 279000,
      shop: { name: "Toko Bu Sari", whatsapp: "6281234567890", slug: "bu-sari" },
      items: [
        { productId: "a", name: "Hijab Voal Paris", option: "Mocca", kind: "physical", unitPrice: 45000, quantity: 2, availability: "ready", leadTime: "" },
        { productId: "b", name: "Gamis Katun Rayon", option: "", kind: "physical", unitPrice: 189000, quantity: 1, availability: "ready", leadTime: "" },
      ],
    },
    "https://x.test/shop/bu-sari/order/k7q2mdabc",
  );
  const lines = message.split("\n");
  assert.equal(lines[0], "Halo Toko Bu Sari, saya Ayu Lestari ingin memesan (Pesanan #K7Q2MD):");
  assert(/^• 2× Hijab Voal Paris \(Mocca\) Rp\s?90\.000$/.test(lines[1]), lines[1]);
  assert(/^• 1× Gamis Katun Rayon Rp\s?189\.000$/.test(lines[2]), lines[2]);
  assert(message.includes("Catatan: Kirim Minggu") && message.endsWith("https://x.test/shop/bu-sari/order/k7q2mdabc"));
  const url = new URL(whatsAppLink("6281234567890", message));
  assert.equal(url.origin + url.pathname, "https://wa.me/6281234567890");
  assert.equal(url.searchParams.get("text"), message);
  assert.deepEqual([179000, 1000, 999, 1250000].map(shortRupiah), ["179rb", "1rb", "999", "1,25jt"]);
  console.log("order message and short prices: PASS");
}
