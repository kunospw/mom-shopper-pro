import {
  doc,
  collection,
  query,
  where,
  getDocFromServer,
  getDocsFromServer,
  writeBatch,
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
  buyerContactSchema,
  orderSignature,
  type BuyerContact,
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


/** A fresh order ID, created once per draft so a retry after a lost response cannot duplicate it. */
export function newOrderId(storeId: string) {
  return doc(collection(db, "storefronts", storeIdSchema.parse(storeId), "orders")).id;
}

/**
 * Re-reads the live catalog, then saves the buyer's request as a pending order
 * under `orderId`. Returns `{ changed }` (with the fresh catalog) if anything the
 * buyer saw changed, `{ closed }` if the shop no longer takes orders.
 *
 * Retry-safe: if an order with this ID already exists (the previous attempt was
 * saved but its response never arrived), it is returned instead of written again.
 */
export async function createOrderRequest(
  storeId: string,
  lines: CartLine[],
  buyerName: string,
  buyerContact: BuyerContact,
  note: string,
  seenSignature: string,
  orderId: string,
) {
  storeIdSchema.parse(orderId);
  const reference = doc(db, "storefronts", storeId, "orders", orderId);
  const previous = await getDocFromServer(reference).catch(() => null);
  if (previous?.exists())
    return { id: orderId, order: readOrder(orderId, previous.data()), existing: true as const };
  const latest = await getPublicCatalog(storeId);
  if (!latest) return { closed: true as const };
  const cart = reconcileCart(lines, latest.products);
  if (
    cart.length !== lines.length ||
    orderSignature(latest.store, latest.products, cart) !== seenSignature
  )
    return { changed: latest, cart };
  const contact = buyerContactSchema.parse(buyerContact);
  const offered = (contact.delivery === undefined || !!latest.store.delivery?.includes(contact.delivery)) &&
    (contact.payment === undefined || !!latest.store.payments?.includes(contact.payment));
  if (!offered) return { changed: latest, cart };
  const request = orderRequestSchema.parse({
    buyerName,
    note,
    items: orderItems(latest.products, cart),
  });
  const saved = {
    status: "pending" as const,
    progress: "pending" as const,
    ...request,
    subtotal: orderSubtotal(request.items),
    trackingNo: "",
    sellerNote: "",
    shop: orderShopSnapshot(latest.store),
  };
  // One batch: the rules accept the contact only alongside its new order.
  const batch = writeBatch(db);
  batch.set(reference, {
    ...saved,
    steps: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(reference, "contact", "buyer"), Object.fromEntries(Object.entries(contact).filter(([, value]) => value !== undefined)));
  await batch.commit();
  const order: Order = {
    id: orderId,
    ...saved,
    buyerPhone: contact.phone,
    buyerDelivery: contact.delivery,
    buyerAddress: contact.address,
    buyerPayment: contact.payment,
    steps: {},
    createdAt: new Date().toISOString(),
  };
  return { id: orderId, order, latest, cart };
}

/**
 * Tracking reads the order alone: the shop name, WhatsApp and slug are frozen
 * into it, so the page still works after the seller unpublishes or the plan ends.
 * Orders created before the snapshot fall back to the storefront (best effort).
 */
export async function getOrderStatus(
  storeId: string,
  orderId: string,
): Promise<{ order: Order; shopName: string; whatsapp: string; slug: string; accent?: string } | null> {
  storeIdSchema.parse(storeId);
  storeIdSchema.parse(orderId);
  try {
    // The storefront is read only for decoration (accent) and for orders made before
    // the snapshot existed; it is unreadable once a shop closes, which is fine.
    const [orderSnapshot, store] = await Promise.all([
      getDocFromServer(doc(db, "storefronts", storeId, "orders", orderId)),
      getDocFromServer(doc(db, "storefronts", storeId))
        .then((snapshot) => (snapshot.exists() ? readStorefront(storeId, snapshot.data()) : null))
        .catch(() => null),
    ]);
    if (!orderSnapshot.exists()) return null;
    const order = readOrder(orderSnapshot.id, orderSnapshot.data());
    const shop = order.shop ?? { name: store?.name ?? "Toko", whatsapp: store?.whatsapp ?? "", slug: store?.slug ?? "" };
    return { order, shopName: shop.name || "Toko", whatsapp: shop.whatsapp, slug: shop.slug, accent: store?.accent };
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
