import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { buyerContactSchema, buyerPhoneSchema, readOrder, storeIdSchema, type Order } from "./catalog";

function ownerId() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error("Masuk sebagai pemilik toko untuk melanjutkan.");
  return storeIdSchema.parse(id);
}

export async function getOwnerOrders(): Promise<Order[]> {
  const snapshot = await getDocsFromServer(
    collection(db, "storefronts", ownerId(), "orders"),
  );
  const orders: Order[] = [];
  for (const item of snapshot.docs) {
    try {
      orders.push(readOrder(item.id, item.data()));
    } catch {
      /* Skip a malformed request rather than hiding every other order. */
    }
  }
  // Contacts (WhatsApp, delivery, payment) are needed to confirm, so only pending requests load them (one read each).
  await Promise.all(
    orders
      .filter((o) => o.status === "pending")
      .map(async (o) => {
        const contact = await getDocFromServer(doc(db, "storefronts", ownerId(), "orders", o.id, "contact", "buyer")).catch(() => null);
        const phone = buyerPhoneSchema.safeParse(contact?.data()?.phone);
        if (phone.success) o.buyerPhone = phone.data;
        const full = buyerContactSchema.safeParse(contact?.data());
        if (full.success) {
          o.buyerDelivery = full.data.delivery;
          o.buyerAddress = full.data.address;
          o.buyerPayment = full.data.payment;
        }
      }),
  );
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Live list of pending order requests (one small listener, pending only, so it
 * stays cheap on the free plan). Returns the unsubscribe function.
 */
export function watchPendingOrders(onChange: (orders: Order[]) => void, onError: () => void = () => undefined) {
  return onSnapshot(
    query(collection(db, "storefronts", ownerId(), "orders"), where("status", "==", "pending")),
    (snapshot) => {
      const orders: Order[] = [];
      for (const item of snapshot.docs) {
        try {
          orders.push(readOrder(item.id, item.data()));
        } catch {
          /* Skip a malformed request. */
        }
      }
      onChange(orders);
    },
    onError,
  );
}

export async function rejectOrder(orderId: string, sellerNote: string) {
  await updateDoc(
    doc(db, "storefronts", ownerId(), "orders", storeIdSchema.parse(orderId)),
    {
      status: "rejected",
      progress: "cancelled",
      "steps.cancelled": serverTimestamp(),
      sellerNote: sellerNote.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    },
  );
}
