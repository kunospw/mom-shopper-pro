import { deleteUser, reauthenticateWithPopup } from "firebase/auth";
import { collection, doc, getDoc, getDocs, writeBatch, type DocumentReference } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { useEmulator } from "./firebase-app";

/** Private collections under users/{uid} (see books-storage.ts and storage.ts). */
export const USER_COLLECTIONS = ["sales", "purchases", "expenses", "customers", "inventory", "transactions", "meta"] as const;

async function remove(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
}
const refsIn = async (...path: [string, ...string[]]) => (await getDocs(collection(db, ...path))).docs.map((d) => d.ref);

/**
 * Deletes the signed-in owner's data and then the account itself.
 *
 * Google is asked to confirm the account first, so a stale session fails before
 * anything is removed. Every step can be repeated: if the connection drops
 * halfway, running it again finishes the job.
 *
 * `entitlements/{uid}` stays (clients cannot delete it): it holds only the trial
 * and plan dates, and keeps the free trial from being restarted.
 */
export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Masuk untuk melanjutkan.");
  const uid = user.uid;
  // The Auth emulator has no Google popup; tests sign in right before deleting.
  if (!useEmulator) await reauthenticateWithPopup(user, googleProvider);

  // Shop: products and link, then the storefront. The rules let an owner remove
  // orders and buyer contacts only once the storefront itself is gone.
  const storeRef = doc(db, "storefronts", uid);
  const store = await getDoc(storeRef);
  await remove(await refsIn("storefronts", uid, "products"));
  const slug = store.exists() ? store.data().slug : "";
  if (typeof slug === "string" && slug) await remove([doc(db, "slugs", slug)]);
  if (store.exists()) await remove([storeRef]);
  const orders = await refsIn("storefronts", uid, "orders");
  await remove(orders.map((order) => doc(order, "contact", "buyer")));
  await remove(orders);

  // Shopee import drafts.
  const jobs = await refsIn("catalogueIngestions", uid, "jobs");
  for (const job of jobs) await remove((await getDocs(collection(job, "drafts"))).docs.map((d) => d.ref));
  await remove(jobs);

  // Books, then the profile.
  for (const name of USER_COLLECTIONS) await remove(await refsIn("users", uid, name));
  await remove([doc(db, "users", uid)]);

  await deleteUser(user);
  try {
    localStorage.clear();
  } catch {
    /* Storage can be unavailable; the account is gone either way. */
  }
}
