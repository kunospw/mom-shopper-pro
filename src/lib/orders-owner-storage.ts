import {
  collection,
  doc,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { readOrder, storeIdSchema, type Order } from "./catalog";

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
