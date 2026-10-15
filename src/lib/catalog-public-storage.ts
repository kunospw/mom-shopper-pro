import {
  doc,
  collection,
  query,
  where,
  getDocFromServer,
  getDocsFromServer,
} from "firebase/firestore";
import { db } from "./firebase-app";
import { storeIdSchema, readStorefront, readProduct } from "./catalog";
export async function getPublicCatalog(storeId: string) {
  storeIdSchema.parse(storeId);
  try {
    const snapshot = await getDocFromServer(doc(db, "storefronts", storeId));
    if (!snapshot.exists()) return null;
    const store = readStorefront(storeId, snapshot.data());
    if (!store.published) return null;
    const products = await getDocsFromServer(
      query(
        collection(db, "storefronts", storeId, "products"),
        where("published", "==", true),
      ),
    );
    return {
      store,
      products: products.docs
        .map((item) => readProduct(item.id, item.data()))
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "permission-denied"
    )
      return null;
    throw error;
  }
}
