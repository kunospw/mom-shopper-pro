import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  productSchema,
  storefrontSchema,
  readStorefront,
  readProduct,
  storeIdSchema,
  type CatalogProductFields,
  type StorefrontFields,
} from "./catalog";
function ownerId() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error("Masuk sebagai pemilik toko untuk melanjutkan.");
  return storeIdSchema.parse(id);
}
export async function getOwnerCatalog() {
  const id = ownerId();
  const [store, products] = await Promise.all([
    getDocFromServer(doc(db, "storefronts", id)),
    getDocsFromServer(collection(db, "storefronts", id, "products")),
  ]);
  return {
    store: store.exists() ? readStorefront(id, store.data()) : null,
    products: products.docs
      .map((item) => readProduct(item.id, item.data()))
      .sort((a, b) => a.name.localeCompare(b.name, "id")),
  };
}
export async function saveStorefront(fields: StorefrontFields) {
  const id = ownerId();
  const safe = storefrontSchema.parse(fields);
  await setDoc(doc(db, "storefronts", id), {
    ...safe,
    updatedAt: serverTimestamp(),
  });
  return { id, ...safe };
}
export async function saveCatalogProduct(
  fields: CatalogProductFields,
  productId?: string,
) {
  const id = ownerId();
  const safe = productSchema.parse(fields);
  const reference = productId
    ? doc(db, "storefronts", id, "products", storeIdSchema.parse(productId))
    : doc(collection(db, "storefronts", id, "products"));
  await setDoc(reference, { ...safe, updatedAt: serverTimestamp() });
  return { id: reference.id, ...safe };
}
export async function deleteCatalogProduct(productId: string) {
  await deleteDoc(
    doc(
      db,
      "storefronts",
      ownerId(),
      "products",
      storeIdSchema.parse(productId),
    ),
  );
}
