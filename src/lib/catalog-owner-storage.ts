import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
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
import { trialStartFields } from "./entitlement-storage";
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
export async function getOwnerStore() {
  const id = ownerId();
  const snapshot = await getDocFromServer(doc(db, "storefronts", id));
  return snapshot.exists() ? readStorefront(id, snapshot.data()) : null;
}
export async function isSlugAvailable(slug: string) {
  const snapshot = await getDocFromServer(doc(db, "slugs", slug));
  return !snapshot.exists() || snapshot.data().storeId === ownerId();
}
export class SlugTakenError extends Error {}
/** Raised when opening the shop is refused because the trial or plan has ended. */
export class TrialEndedError extends Error {
  name = "TrialEndedError";
}
export async function saveStorefront(
  fields: StorefrontFields,
  previousSlug = "",
  options: { startTrial?: boolean; reopening?: boolean } = {},
) {
  const id = ownerId();
  const safe = storefrontSchema.parse(fields);
  // The storefront and its slug claim change together or not at all.
  const batch = writeBatch(db);
  batch.set(doc(db, "storefronts", id), {
    ...Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== undefined)),
    updatedAt: serverTimestamp(),
  });
  if (previousSlug && previousSlug !== safe.slug)
    batch.delete(doc(db, "slugs", previousSlug));
  if (safe.slug && safe.slug !== previousSlug) {
    if (!(await isSlugAvailable(safe.slug))) throw new SlugTakenError();
    batch.set(doc(db, "slugs", safe.slug), { storeId: id });
  }
  // First publish: the trial starts in the same atomic write (rules require both together).
  if (options.startTrial && safe.published)
    batch.set(doc(db, "entitlements", id), trialStartFields());
  try {
    await batch.commit();
  } catch (error) {
    if (
      options.reopening &&
      safe.published &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "permission-denied"
    )
      throw new TrialEndedError();
    throw error;
  }
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
