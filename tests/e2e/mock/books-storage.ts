import { derive, saleNumber, saleStockDeltas, purchaseStockDeltas } from "@/lib/books";
import { db, save, clone, nextId } from "./mockdb";
const byDate = (xs: any[]) => clone(xs).sort((a, b) => b.date.localeCompare(a.date));
export const getSales = async () => byDate(db.sales);
export const getPurchases = async () => byDate(db.purchases);
export const getExpenses = async () => byDate(db.expenses);
export const getCustomers = async () => clone(db.customers);
export const getInventory = async () => clone(db.inventory);
export const newId = (p: string) => nextId(p);
export const saveInventory = async (id: string, v: any) => { db.inventory[id] = v; save(); };
function stock(d: Map<string, number>) { for (const [k, v] of d) if (typeof db.inventory[k]?.stock === "number") db.inventory[k].stock += v; }
const live = (s: any) => s.fulfillment.status !== "cancelled";
function mirror(sale: any, status = sale.fulfillment.status) {
  if (!sale.orderRequestId) return;
  const o = db.orders.find((x: any) => x.id === sale.orderRequestId);
  if (!o) throw new Error("order missing");
  o.status = "confirmed";
  if (o.progress !== status) { o.steps = { ...(o.steps ?? {}), [status]: new Date().toISOString() }; }
  o.progress = status;
  o.trackingNo = [sale.fulfillment.courier, sale.fulfillment.trackingNo].filter(Boolean).join(" · ");
}
export async function saveSale(input: any, existing: any, ctx: any = {}) {
  const id = existing?.id ?? nextId("sale");
  const sale = { ...derive(input), id, number: existing?.number ?? saleNumber(input.date, ctx.sequence ?? 1) };
  if (existing && live(existing)) stock(saleStockDeltas(existing.items, 1));
  if (live(sale)) stock(saleStockDeltas(sale.items, -1));
  mirror(sale);
  db.sales = [...db.sales.filter((s: any) => s.id !== id), clone(sale)];
  save();
  return sale;
}
export async function deleteSale(s: any) { if (live(s)) stock(saleStockDeltas(s.items, 1)); mirror(s, "cancelled"); db.sales = db.sales.filter((x: any) => x.id !== s.id); save(); }
export async function savePurchase(p: any, existing?: any) {
  if (existing) stock(new Map([...purchaseStockDeltas(existing.items)].map(([k, v]) => [k, -v])));
  stock(purchaseStockDeltas(p.items));
  db.purchases = [...db.purchases.filter((x: any) => x.id !== p.id), p]; save();
}
export async function deletePurchase(p: any) { stock(new Map([...purchaseStockDeltas(p.items)].map(([k, v]) => [k, -v]))); db.purchases = db.purchases.filter((x: any) => x.id !== p.id); save(); }
export async function saveExpense(e: any) { db.expenses = [...db.expenses.filter((x: any) => x.id !== e.id), e]; save(); }
export async function deleteExpense(id: string) { db.expenses = db.expenses.filter((x: any) => x.id !== id); save(); }
export async function saveCustomer(c: any) { db.customers = [...db.customers.filter((x: any) => x.id !== c.id), c]; save(); }
export async function deleteCustomer(id: string) { db.customers = db.customers.filter((x: any) => x.id !== id); save(); }
export async function migrateLegacyTransactions() { return 0; }
(globalThis as any).__saveSale = saveSale; (globalThis as any).__savePurchase = savePurchase; (globalThis as any).__saveExpense = saveExpense; (globalThis as any).__saveCustomer = saveCustomer;
