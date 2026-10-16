import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
  updateDoc,
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
