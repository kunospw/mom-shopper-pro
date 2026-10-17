import { db, save, clone } from "./mockdb";
export const getEntitlement = async () => (db.entitlement ? clone(db.entitlement) : null);
export const trialStartFields = () => ({});
export async function startTrial() {
  if (db.entitlement || !db.store.published) throw new Error("denied");
  db.entitlement = { trialStartedAt: new Date().toISOString(), paidUntil: null };
  save();
}
