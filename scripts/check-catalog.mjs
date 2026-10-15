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
} = model;
const store = {
  id: "seller-a",
  name: "Toko & Melati",
  description: "Produk pilihan",
  whatsapp: "6281234567890",
  accent: "teal",
  logo: "",
  published: true,
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
  options: ["Hitam", "Putih"],
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
  { options: ["A", "A"] },
  { options: Array(9).fill("A") },
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
console.log(
  "PASS: listing/store validation, public projections, cart tampering and reconciliation, current pricing, WhatsApp encoding and unpublished-order rejection.",
);
