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
  options: ["Hitam", "Putih"],
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
    { options: ["A", "A"] },
    { options: ["A", "B", "C", "D", "E", "F", "G", 5] },
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
