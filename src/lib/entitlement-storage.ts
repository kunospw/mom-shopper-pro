import { doc, getDocFromServer, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { storeIdSchema } from "./catalog";
import type { Entitlement } from "./entitlement";

function ownerId() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error("Masuk sebagai pemilik toko untuk melanjutkan.");
  return storeIdSchema.parse(id);
}

const iso = (value: unknown) => {
  const stamp = value as { toDate?: () => Date } | null | undefined;
  return stamp?.toDate ? stamp.toDate().toISOString() : null;
};

export async function getEntitlement(): Promise<Entitlement | null> {
  const snapshot = await getDocFromServer(doc(db, "entitlements", ownerId()));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { trialStartedAt: iso(data.trialStartedAt) ?? "", paidUntil: iso(data.paidUntil) };
}

/** The write that starts the trial; rules require the storefront to be published in the same batch. */
export function trialStartFields() {
  return { trialStartedAt: serverTimestamp(), paidUntil: null };
}

/** For older published shops during the grace period: start the trial without editing the shop. */
export async function startTrial() {
  const batch = writeBatch(db);
  batch.set(doc(db, "entitlements", ownerId()), trialStartFields());
  await batch.commit();
}
