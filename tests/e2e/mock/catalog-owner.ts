import { db, save, clone } from "./mockdb";
export const getOwnerCatalog = async () => ({ store: clone(db.store), products: clone(db.products) });
export const getOwnerStore = async () => clone(db.store);
export const isSlugAvailable = async (slug: string) => !db.slugs[slug] || db.slugs[slug] === "u1";
export class SlugTakenError extends Error { constructor() { super("taken"); this.name = "SlugTakenError"; } }
export class TrialEndedError extends Error { constructor() { super("trial ended"); this.name = "TrialEndedError"; } }
const DAY = 86400000;
export async function saveStorefront(f: any, prev = "", options: { startTrial?: boolean; reopening?: boolean } = {}) {
  // Mirrors the rules: opening a closed shop needs a running trial, or starts one in the same write.
  if (f.published && !db.store?.published) {
    const e = db.entitlement;
    const running = e && (Date.now() < new Date(e.trialStartedAt).getTime() + 7 * DAY || (e.paidUntil && Date.now() < new Date(e.paidUntil).getTime()));
    if (e && !running) throw new TrialEndedError();
    if (!e && !options.startTrial) throw new Error("permission-denied");
    if (!e) db.entitlement = { trialStartedAt: new Date().toISOString(), paidUntil: null };
  }
  if (f.slug && f.slug !== prev && db.slugs[f.slug] && db.slugs[f.slug] !== "u1") throw new SlugTakenError();
  if (prev && prev !== f.slug) delete db.slugs[prev];
  if (f.slug) db.slugs[f.slug] = "u1";
  db.store = { id: "u1", ...f }; save();
  return clone(db.store);
}
export async function saveCatalogProduct(f: any, id?: string) {
  const saved = { id: id ?? `p${db.products.length + 1}`, ...f };
  db.products = [...db.products.filter((p: any) => p.id !== saved.id), saved]; save();
  return clone(saved);
}
export async function deleteCatalogProduct(id: string) { db.products = db.products.filter((p: any) => p.id !== id); save(); }
