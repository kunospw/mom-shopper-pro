import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  assertValidSale,
  derive,
  normalizeSale,
  purchaseStockDeltas,
  saleNumber,
  saleStockDeltas,
  migrateLegacy,
} from "./books";
import type {
  Customer,
  Expense,
  Inventory,
  Purchase,
  Sale,
  SaleInput,
} from "@/types/books";
import type { Transaction } from "@/types/transaction";

function uid() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error("Masuk untuk melanjutkan.");
  return id;
}
const col = (name: string) => collection(db, "users", uid(), name);
const ref = (name: string, id: string) => doc(db, "users", uid(), name, id);

// Firestore rejects `undefined`; drop it before writing.
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function list<T>(name: string): Promise<T[]> {
  const snapshot = await getDocs(col(name));
  return snapshot.docs.map((d) => {
    const { createdAt: _c, updatedAt: _u, ...data } = d.data();
    return { ...data, id: d.id } as T;
  });
}
const byDateDesc = <T extends { date: string }>(xs: T[]) =>
  xs.sort((a, b) => b.date.localeCompare(a.date));

export async function getSales() {
  // Re-derive so stale or pre-refund records never feed the UI or the reports.
  return byDateDesc((await list<Sale>("sales")).map(normalizeSale));
}
export async function getPurchases() {
  return byDateDesc(await list<Purchase>("purchases"));
}
export async function getExpenses() {
  return byDateDesc(await list<Expense>("expenses"));
}
export async function getCustomers() {
  return (await list<Customer>("customers")).sort((a, b) =>
    a.name.localeCompare(b.name, "id"),
  );
}
export async function getInventory() {
  const snapshot = await getDocs(col("inventory"));
  return Object.fromEntries(
    snapshot.docs.map((d) => [d.id, d.data() as Inventory]),
  ) as Record<string, Inventory>;
}

export async function saveInventory(productId: string, value: Inventory) {
  await setDoc(ref("inventory", productId), {
    cost: Math.max(0, Math.round(value.cost) || 0),
    stock: value.stock === null ? null : Math.round(value.stock),
  });
}

/** Apply stock deltas only to products whose stock is tracked (a number). */
async function applyStock(batch: WriteBatch, deltas: Map<string, number>) {
  for (const [productId, delta] of deltas) {
    if (!delta) continue;
    const snapshot = await getDoc(ref("inventory", productId));
    if (snapshot.exists() && typeof snapshot.data().stock === "number")
      batch.update(ref("inventory", productId), { stock: increment(delta) });
  }
}

function mergeDeltas(
  a: Map<string, number>,
  b: Map<string, number>,
): Map<string, number> {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

/** Public mirror of a catalog sale's progress (no private delivery notes). */
function mirrorOrder(batch: WriteBatch, sale: Sale, status = sale.fulfillment.status) {
  if (!sale.orderRequestId) return;
  const { courier, trackingNo } = sale.fulfillment;
  batch.update(doc(db, "storefronts", uid(), "orders", sale.orderRequestId), {
    status: "confirmed",
    progress: status,
    trackingNo: [courier, trackingNo].filter(Boolean).join(" · ").slice(0, 60),
    updatedAt: serverTimestamp(),
  });
}

const isLive = (s: Pick<Sale, "fulfillment">) =>
  s.fulfillment.status !== "cancelled";

/**
 * Create or update a sale. Stock moves by the difference between the stock the
 * previous version held and what this version needs, so edits, cancels and
 * re-opens all stay consistent. `extra` lets callers write related docs
 * (e.g. the catalog order) in the same atomic batch.
 */
export async function saveSale(
  input: SaleInput,
  existing?: Sale,
  context: { sequence?: number; extra?: (batch: WriteBatch) => void } = {},
): Promise<Sale> {
  // Refuse an invalid payment/refund ledger before anything is written.
  assertValidSale(input);
  const id = existing?.id ?? doc(col("sales")).id;
  const sale: Sale = {
    ...derive(input),
    id,
    number:
      existing?.number ?? saleNumber(input.date, context.sequence ?? 1),
  };
  const batch = writeBatch(db);
  batch.set(ref("sales", id), {
    ...clean(sale),
    updatedAt: serverTimestamp(),
    ...(existing ? {} : { createdAt: serverTimestamp() }),
  }, { merge: false });
  const released = existing && isLive(existing)
    ? saleStockDeltas(existing.items, 1)
    : new Map<string, number>();
  const taken = isLive(sale)
    ? saleStockDeltas(sale.items, -1)
    : new Map<string, number>();
  await applyStock(batch, mergeDeltas(released, taken));
  mirrorOrder(batch, sale);
  context.extra?.(batch);
  await batch.commit();
  return sale;
}

export async function deleteSale(sale: Sale) {
  const batch = writeBatch(db);
  batch.delete(ref("sales", sale.id));
  mirrorOrder(batch, sale, "cancelled");
  if (isLive(sale)) await applyStock(batch, saleStockDeltas(sale.items, 1));
  await batch.commit();
}

export async function savePurchase(purchase: Purchase, existing?: Purchase) {
  const batch = writeBatch(db);
  batch.set(ref("purchases", purchase.id), {
    ...clean(purchase),
    updatedAt: serverTimestamp(),
  });
  const removed = existing
    ? new Map(
        [...purchaseStockDeltas(existing.items)].map(([k, v]) => [k, -v]),
      )
    : new Map<string, number>();
  await applyStock(
    batch,
    mergeDeltas(removed, purchaseStockDeltas(purchase.items)),
  );
  await batch.commit();
}
export async function deletePurchase(purchase: Purchase) {
  const batch = writeBatch(db);
  batch.delete(ref("purchases", purchase.id));
  await applyStock(
    batch,
    new Map(
      [...purchaseStockDeltas(purchase.items)].map(([k, v]) => [k, -v]),
    ),
  );
  await batch.commit();
}

export const newId = (name: string) => doc(col(name)).id;

export async function saveExpense(expense: Expense) {
  await setDoc(ref("expenses", expense.id), {
    ...clean(expense),
    updatedAt: serverTimestamp(),
  });
}
export const deleteExpense = (id: string) => deleteDoc(ref("expenses", id));

export async function saveCustomer(customer: Customer) {
  await setDoc(ref("customers", customer.id), {
    ...clean(customer),
    updatedAt: serverTimestamp(),
  });
}
export const deleteCustomer = (id: string) => deleteDoc(ref("customers", id));

/**
 * One-time, idempotent copy of legacy `transactions` into sales/purchases.
 * Reuses the legacy doc ID so repeating it overwrites rather than duplicates,
 * and never touches or deletes the legacy docs. Skips docs that already exist
 * so later edits to migrated records are not overwritten. Runs once per owner
 * (see the `meta/books` marker); if it fails part-way it retries next load.
 */
export async function migrateLegacyTransactions(): Promise<number> {
  // A completion marker stops deleted records from being re-imported later.
  const marker = ref("meta", "books");
  if ((await getDoc(marker)).exists()) return 0;
  const legacy = await getDocs(col("transactions"));
  if (legacy.empty) {
    await setDoc(marker, { legacyMigratedAt: serverTimestamp(), count: 0 });
    return 0;
  }
  const [sales, purchases] = await Promise.all([
    getDocs(col("sales")),
    getDocs(col("purchases")),
  ]);
  const have = new Set([
    ...sales.docs.map((d) => `s:${d.id}`),
    ...purchases.docs.map((d) => `p:${d.id}`),
  ]);
  let batch = writeBatch(db);
  let pending = 0;
  let written = 0;
  let sequence = sales.size;
  const ordered = legacy.docs
    .map((d) => ({ ...(d.data() as Transaction), id: d.id }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  for (const t of ordered) {
    const converted = migrateLegacy(t);
    if (!converted) continue;
    if (converted.kind === "sale") {
      if (have.has(`s:${t.id}`)) continue;
      sequence += 1;
      const number = saleNumber(converted.sale.date, sequence);
      batch.set(ref("sales", t.id), {
        ...clean({ ...converted.sale, id: t.id, number }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      if (have.has(`p:${t.id}`)) continue;
      batch.set(ref("purchases", t.id), {
        ...clean(converted.purchase),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    written += 1;
    if (++pending === 400) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  await setDoc(marker, { legacyMigratedAt: serverTimestamp(), count: written });
  return written;
}
