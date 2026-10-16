import {
  doc,
  collection,
  query,
  where,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase-app";
import {
  storeIdSchema,
  slugPattern,
  readStorefront,
  readProduct,
  readOrder,
  reconcileCart,
  orderItems,
  orderSubtotal,
  orderShopSnapshot,
  orderRequestSchema,
  orderSignature,
  type CartLine,
  type Order,
} from "./catalog";

/** A shop link is either a readable slug or (older links) the owner's ID. */
export async function resolveStore(param: string): Promise<string | null> {
  if (slugPattern.test(param)) {
    try {
      const snapshot = await getDocFromServer(doc(db, "slugs", param));
      const target = snapshot.exists() ? snapshot.data().storeId : null;
      if (typeof target === "string" && storeIdSchema.safeParse(target).success)
        return target;
    } catch {
      /* Fall through: the link may be an owner ID. */
    }
  }
  return storeIdSchema.safeParse(param).success ? param : null;
}


/**
 * Re-reads the live catalog, then saves the buyer's request as a pending order.
 * Throws OrderChangedError (with the fresh catalog) if anything the buyer saw changed.
 */
export async function createOrderRequest(
  storeId: string,
  lines: CartLine[],
  buyerName: string,
  note: string,
  seenSignature: string,
) {
  const latest = await getPublicCatalog(storeId);
  if (!latest) return { closed: true as const };
  const cart = reconcileCart(lines, latest.products);
  if (
    cart.length !== lines.length ||
    orderSignature(latest.store, latest.products, cart) !== seenSignature
  )
    return { changed: latest, cart };
  const request = orderRequestSchema.parse({
    buyerName,
    note,
    items: orderItems(latest.products, cart),
  });
  const reference = doc(collection(db, "storefronts", storeId, "orders"));
  await setDoc(reference, {
    status: "pending",
    progress: "pending",
    ...request,
    subtotal: orderSubtotal(request.items),
    trackingNo: "",
    sellerNote: "",
    shop: orderShopSnapshot(latest.store),
    steps: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: reference.id, latest, cart };
}

/**
 * Tracking reads the order alone: the shop name, WhatsApp and slug are frozen
 * into it, so the page still works after the seller unpublishes or the plan ends.
 * Orders created before the snapshot fall back to the storefront (best effort).
 */
export async function getOrderStatus(
  storeId: string,
  orderId: string,
): Promise<{ order: Order; shopName: string; whatsapp: string; slug: string } | null> {
  storeIdSchema.parse(storeId);
  storeIdSchema.parse(orderId);
  try {
    const orderSnapshot = await getDocFromServer(doc(db, "storefronts", storeId, "orders", orderId));
    if (!orderSnapshot.exists()) return null;
    const order = readOrder(orderSnapshot.id, orderSnapshot.data());
    if (order.shop)
      return { order, shopName: order.shop.name || "Toko", whatsapp: order.shop.whatsapp, slug: order.shop.slug };
    let store = null;
    try {
      const storeSnapshot = await getDocFromServer(doc(db, "storefronts", storeId));
      store = storeSnapshot.exists() ? readStorefront(storeId, storeSnapshot.data()) : null;
    } catch {
      /* An unpublished shop is unreadable; the order itself is still shown. */
    }
    return { order, shopName: store?.name ?? "Toko", whatsapp: store?.whatsapp ?? "", slug: store?.slug ?? "" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "permission-denied") return null;
    throw error;
  }
}
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
