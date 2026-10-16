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
  await assertSucceeds(setDoc(doc(owner, "storefronts/seller-a"), shop));
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
    { note: "x".repeat(301) },
    { subtotal: 0 },
    { items: [] },
    { items: Array(7).fill(item) },
    { items: [{ ...item, unitPrice: -1 }] },
    { items: [{ ...item, quantity: 100 }] },
    { items: [{ ...item, availability: "unavailable" }] },
    { items: [{ ...item, extra: true }] },
    { extra: true },
    { createdAt: new Date("2020-01-01") },
  ])
    await assertFails(
      setDoc(doc(buyer, `${orderPath}/bad`), { ...order, ...invalid }),
    );
  await assertSucceeds(
    setDoc(doc(buyer, `${orderPath}/ten`), {
      ...order,
      items: Array(6).fill(item),
    }),
  );
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
