import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const dependencyRoot = process.env.CATALOG_TEST_TOOLING;
if (!dependencyRoot || !process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    "Use isolated tooling and a Firestore emulator; never production.",
  );
const requireTool = createRequire(`${dependencyRoot}/package.json`);
const { initializeTestEnvironment, assertSucceeds, assertFails } = requireTool(
  "@firebase/rules-unit-testing",
);
const {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} = requireTool("firebase/firestore");
const rules = await readFile(
  new URL("../../firebase/firestore.rules", import.meta.url),
  "utf8",
);
const env = await initializeTestEnvironment({
  projectId: "demo-catalog-tests",
  firestore: { rules },
});
const owner = env.authenticatedContext("seller-a").firestore();
const other = env.authenticatedContext("seller-b").firestore();
const buyer = env.unauthenticatedContext().firestore();
const shop = {
  name: "Toko A",
  description: "",
  whatsapp: "6281234567890",
  accent: "teal",
  logo: "",
  published: true,
  slug: "",
  updatedAt: serverTimestamp(),
};
const trial = () => ({ trialStartedAt: serverTimestamp(), paidUntil: null });
// A new shop opens together with its trial; the rules refuse any other first publish.
const openShop = (db, id, data = shop) => {
  const batch = writeBatch(db);
  batch.set(doc(db, `storefronts/${id}`), data);
  batch.set(doc(db, `entitlements/${id}`), trial());
  return batch.commit();
};
const product = {
  name: "Kemeja",
  description: "",
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
  updatedAt: serverTimestamp(),
};
try {
  await env.clearFirestore();
  await assertFails(setDoc(doc(owner, "storefronts/seller-a"), shop)); // no trial, no publishing
  await assertSucceeds(openShop(owner, "seller-a"));
  await assertSucceeds(
    setDoc(doc(owner, "storefronts/seller-a/products/public"), product),
  );
  await assertSucceeds(
    setDoc(doc(owner, "storefronts/seller-a/products/draft"), {
      ...product,
      published: false,
    }),
  );
  await assertSucceeds(getDoc(doc(buyer, "storefronts/seller-a")));
  await assertSucceeds(
    getDoc(doc(buyer, "storefronts/seller-a/products/public")),
  );
  await assertFails(getDoc(doc(buyer, "storefronts/seller-a/products/draft")));
  await assertFails(getDoc(doc(other, "storefronts/seller-a/products/draft")));
  await assertFails(
    getDocs(collection(buyer, "storefronts/seller-a/products")),
  );
  const visible = await assertSucceeds(
    getDocs(
      query(
        collection(buyer, "storefronts/seller-a/products"),
        where("published", "==", true),
      ),
    ),
  );
  assert.equal(visible.size, 1);
  await assertFails(getDocs(collection(buyer, "storefronts")));
  await assertFails(setDoc(doc(buyer, "storefronts/seller-a"), shop));
  await assertFails(setDoc(doc(other, "storefronts/seller-a"), shop));
  await assertFails(
    setDoc(doc(other, "storefronts/seller-a/products/hijack"), product),
  );
  await assertFails(
    deleteDoc(doc(other, "storefronts/seller-a/products/public")),
  );
  await assertFails(
    setDoc(doc(owner, "storefronts/seller-a/products/leak"), {
      ...product,
      basePrice: 50000,
      buyerName: "Private",
    }),
  );
  await assertFails(
    setDoc(doc(owner, "storefronts/seller-a"), {
      ...shop,
      email: "private@example.test",
    }),
  );
  for (const invalid of [
    { price: -1 },
    { price: 1.5 },
    { availability: "preorder", leadTime: "" },
    { options: [{ secret: true }] },
    { options: ["A"] },
    { options: [{ label: "A", price: -1 }] },
    { options: [{ label: "A", price: 1.5 }] },
    { options: [{ label: "", price: 0 }] },
    { options: Array(9).fill({ label: "A", price: 0 }) },
    { kind: "service" },
    { image: "data:image/svg+xml;base64,PHN2Zz4=" },
  ])
    await assertFails(
      setDoc(doc(owner, "storefronts/seller-a/products/bad"), {
        ...product,
        ...invalid,
      }),
    );
  await assertFails(
    setDoc(doc(owner, "storefronts/seller-a"), {
      ...shop,
      whatsapp: "javascript:alert(1)",
    }),
  );
  await assertSucceeds(
    setDoc(doc(owner, "users/seller-a/transactions/private"), {
      buyerName: "Private buyer",
      basePrice: 50000,
    }),
  );
  await assertSucceeds(
    getDoc(doc(owner, "users/seller-a/transactions/private")),
  );
  await assertSucceeds(
    setDoc(doc(owner, "users/seller-a"), { businessName: "Toko A" }),
  );
  await assertSucceeds(getDoc(doc(owner, "users/seller-a")));
  await assertSucceeds(
    getDocs(collection(owner, "users/seller-a/transactions")),
  );
  await assertFails(getDoc(doc(other, "users/seller-a")));
  await assertFails(getDoc(doc(buyer, "users/seller-a")));
  await assertFails(
    setDoc(doc(other, "users/seller-a"), { businessName: "Hijacked" }),
  );
  await assertFails(
    setDoc(doc(other, "users/seller-a/transactions/private"), {
      buyerName: "Hijacked",
    }),
  );
  await assertFails(
    deleteDoc(doc(other, "users/seller-a/transactions/private")),
  );
  await assertFails(getDocs(collection(other, "users/seller-a/transactions")));
  await assertFails(getDocs(collection(other, "users")));
  await assertFails(setDoc(doc(owner, "unrelated/data"), { value: true }));
  await assertFails(getDoc(doc(buyer, "users/seller-a/transactions/private")));
  await assertFails(getDoc(doc(other, "users/seller-a/transactions/private")));
  // setup questionnaire: four bounded strings, public like the storefront
  const profile = { products: "Kebaya brokat", policies: "PO 7 hari", hours: "08.00-20.00", greeting: "Kak" };
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, profile }));
  for (const invalid of [
    { ...profile, extra: "x" },
    { products: "Kebaya", policies: "PO", hours: "pagi" },
    { ...profile, products: "x".repeat(501) },
    { ...profile, policies: 5 },
    { ...profile, hours: "x".repeat(101) },
    { ...profile, greeting: "x".repeat(21) },
    "Kebaya",
  ])
    await assertFails(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, profile: invalid }));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
  // accents: forest is allowed, unknown colors are not
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, accent: "forest" }));
  for (const accent of ["pink", "Forest", ""])
    await assertFails(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, accent }));
  // shop assistant opt-in: optional boolean
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, assistant: true }));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, assistant: false }));
  for (const assistant of ["yes", 1, null])
    await assertFails(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, assistant }));
  await assertFails(setDoc(doc(other, "storefronts/seller-a"), { ...shop, assistant: true }));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
  // ---- orders, slugs (PR B) ----
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
  const item = {
    productId: "public",
    name: "Kemeja",
    option: "Hitam",
    kind: "physical",
    unitPrice: 150000,
    quantity: 2,
    availability: "ready",
    leadTime: "",
  };
  const order = {
    status: "pending",
    progress: "pending",
    buyerName: "Siti",
    note: "",
    items: [item],
    subtotal: 300000,
    trackingNo: "",
    sellerNote: "",
    shop: { name: "Toko A", whatsapp: "6281234567890", slug: "" },
    steps: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const orderPath = "storefronts/seller-a/orders";
  await assertSucceeds(setDoc(doc(buyer, `${orderPath}/o1`), order));
  await assertSucceeds(getDoc(doc(buyer, `${orderPath}/o1`)));
  await assertFails(getDocs(collection(buyer, orderPath)));
  await assertFails(getDocs(collection(other, orderPath)));
  await assertSucceeds(getDocs(collection(owner, orderPath)));
  for (const invalid of [
    { status: "confirmed" },
    { progress: "shipped" },
    { trackingNo: "X" },
    { sellerNote: "hi" },
    { buyerName: "" },
    { buyerName: "x".repeat(61) },
    { buyerPhone: "6281234567890" },
    { note: "x".repeat(301) },
    { subtotal: 0 },
    { items: [] },
    { items: Array(7).fill(item) },
    { items: [{ ...item, unitPrice: -1 }] },
    { items: [{ ...item, quantity: 100 }] },
    { items: [{ ...item, availability: "unavailable" }] },
    { items: [{ ...item, extra: true }] },
    { extra: true },
    { shop: { name: "Toko Palsu", whatsapp: "6281234567890", slug: "" } },
    { shop: { name: "Toko A", whatsapp: "6280000000000", slug: "" } },
    { shop: { name: "Toko A", whatsapp: "6281234567890", slug: "other" } },
    { shop: { name: "Toko A", whatsapp: "6281234567890", slug: "", extra: 1 } },
    { shop: undefined },
    { steps: { confirmed: new Date() } },
    { steps: undefined },
    { createdAt: new Date("2020-01-01") },
  ])
  {
    const body = { ...order, ...invalid };
    for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
    await assertFails(setDoc(doc(buyer, `${orderPath}/bad`), body));
  }
  await assertSucceeds(
    setDoc(doc(buyer, `${orderPath}/ten`), {
      ...order,
      items: Array(6).fill(item),
    }),
  );
  // Buyer's WhatsApp number: written only with a new order, read only by the seller.
  const withContact = (id, phone, items = [item]) => {
    const batch = writeBatch(buyer);
    batch.set(doc(buyer, `${orderPath}/${id}`), { ...order, items });
    batch.set(doc(buyer, `${orderPath}/${id}/contact/buyer`), phone);
    return batch.commit();
  };
  await assertSucceeds(withContact("p1", { phone: "6281234567890" }, Array(6).fill(item)));
  await assertSucceeds(getDoc(doc(owner, `${orderPath}/p1/contact/buyer`)));
  await assertFails(getDoc(doc(buyer, `${orderPath}/p1/contact/buyer`)));
  await assertFails(getDoc(doc(other, `${orderPath}/p1/contact/buyer`)));
  await assertFails(updateDoc(doc(buyer, `${orderPath}/p1/contact/buyer`), { phone: "6289999999999" }));
  await assertFails(setDoc(doc(buyer, `${orderPath}/o1/contact/buyer`), { phone: "6281234567890" }));
  await assertFails(setDoc(doc(buyer, `${orderPath}/none/contact/buyer`), { phone: "6281234567890" }));
  for (const [i, bad] of [{ phone: "081234567890" }, { phone: "62123" }, { phone: 6281234567890 }, { phone: "6281234567890", name: "x" }].entries())
    await assertFails(withContact(`bad-contact-${i}`, bad));
  {
    const batch = writeBatch(buyer);
    batch.set(doc(buyer, `${orderPath}/p2`), order);
    batch.set(doc(buyer, `${orderPath}/p2/contact/other`), { phone: "6281234567890" });
    await assertFails(batch.commit());
  }
  // Checkout choices: only what the shop offers; an address only (and always) with delivery.
  const phone = "6281234567890";
  const address = "Jl. Melati No. 5, RT 02/RW 03";
  await assertFails(withContact("c-none", { phone, delivery: "pickup" }));
  await assertFails(withContact("c-none-pay", { phone, payment: "qris" }));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, delivery: ["deliver", "pickup"], payments: ["transfer", "cod", "qris"] }));
  await assertSucceeds(withContact("c1", { phone, delivery: "deliver", address, payment: "qris" }, Array(6).fill(item)));
  await assertSucceeds(withContact("c2", { phone, delivery: "pickup", payment: "cod" }));
  await assertSucceeds(withContact("c3", { phone }));
  for (const [i, bad] of [
    { phone, delivery: "deliver", payment: "qris" },
    { phone, delivery: "deliver", address: "Jl. A", payment: "qris" },
    { phone, delivery: "deliver", address: "x".repeat(301) },
    { phone, delivery: "pickup", address },
    { phone, address },
    { phone, delivery: "courier" },
    { phone, payment: "ewallet" },
    { phone, delivery: "deliver", address: 12345678901 },
  ].entries())
    await assertFails(withContact(`c-bad-${i}`, bad));
  for (const invalid of [{ delivery: ["courier"] }, { delivery: "deliver" }, { payments: ["cash"] }, { payments: ["transfer", "cod", "qris", "ewallet", "cod"] }])
    await assertFails(setDoc(doc(owner, "storefronts/seller-a"), { ...shop, ...invalid }));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
  await assertFails(
    updateDoc(doc(buyer, `${orderPath}/o1`), {
      status: "confirmed",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(other, `${orderPath}/o1`), {
      status: "confirmed",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(owner, `${orderPath}/o1`), {
      subtotal: 1,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(owner, `${orderPath}/o1`), {
      status: "confirmed",
      progress: "confirmed",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(owner, `${orderPath}/o1`), {
      status: "rejected",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(owner, `${orderPath}/o1`), {
      progress: "shipped",
      trackingNo: "JNE123",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(owner, `${orderPath}/o1`)));
  await assertSucceeds(
    setDoc(doc(owner, "storefronts/seller-a"), { ...shop, published: false }),
  );
  await assertFails(setDoc(doc(buyer, `${orderPath}/closed`), order));
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
  // slugs
  const claim = writeBatch(owner);
  claim.set(doc(owner, "storefronts/seller-a"), { ...shop, slug: "toko-a" });
  claim.set(doc(owner, "slugs/toko-a"), { storeId: "seller-a" });
  await assertSucceeds(claim.commit());
  await assertSucceeds(getDoc(doc(buyer, "slugs/toko-a")));
  await assertFails(getDocs(collection(buyer, "slugs")));
  await assertFails(setDoc(doc(other, "slugs/toko-a"), { storeId: "seller-b" }));
  await assertFails(setDoc(doc(other, "slugs/free-name"), { storeId: "seller-a" }));
  await assertFails(setDoc(doc(owner, "slugs/not-mine"), { storeId: "seller-a" }));
  await assertFails(setDoc(doc(owner, "slugs/toko-a"), { storeId: "seller-b" }));
  await assertFails(deleteDoc(doc(other, "slugs/toko-a")));
  // a storefront cannot point at a slug it does not own
  const rival = writeBatch(other);
  rival.set(doc(other, "storefronts/seller-b"), { ...shop, slug: "rival-shop" });
  rival.set(doc(other, "slugs/rival-shop"), { storeId: "seller-b" });
  rival.set(doc(other, "entitlements/seller-b"), trial());
  await assertSucceeds(rival.commit());
  await assertFails(
    setDoc(doc(owner, "storefronts/seller-a"), { ...shop, slug: "rival-shop" }),
  );
  await assertFails(
    setDoc(doc(owner, "storefronts/seller-a"), { ...shop, slug: "never-claimed" }),
  );
  for (const slug of ["admin", "Ab_c", "ab", "-abc", "x".repeat(31)])
    await assertFails(
      setDoc(doc(owner, "storefronts/seller-a"), { ...shop, slug }),
    );
  await assertSucceeds(deleteDoc(doc(owner, "slugs/toko-a")));
  await assertSucceeds(
    setDoc(doc(owner, "storefronts/seller-a"), { ...shop, published: false }),
  );
  await assertFails(getDoc(doc(buyer, "storefronts/seller-a")));
  await assertFails(getDoc(doc(buyer, "storefronts/seller-a/products/public")));
  await assertFails(
    getDocs(
      query(
        collection(buyer, "storefronts/seller-a/products"),
        where("published", "==", true),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(collection(owner, "storefronts/seller-a/products")),
  );
  await assertSucceeds(
    deleteDoc(doc(owner, "storefronts/seller-a/products/draft")),
  );
  console.log(
    "PASS: owner isolation, anonymous publishing boundary, field validation, closed stores, and private profile/transaction isolation in proposed deployment rules.",
  );
} finally {
  await env.cleanup();
}
