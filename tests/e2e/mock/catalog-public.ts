import { db, save, clone, nextId } from "./mockdb";
import { readProduct, readStorefront, readOrder, reconcileCart, orderItems, orderSubtotal, orderRequestSchema, orderSignature, orderShopSnapshot } from "@/lib/catalog";
export async function resolveStore(param: string) { return db.slugs[param] ?? (param === "u1" ? "u1" : null); }
// Test hooks: window.__fail = "before" (nothing saved) | "after" (saved, response lost)
const fault = () => (globalThis as any).__fail as string | undefined;
export async function getPublicCatalog(id: string) {
  if (id !== "u1" || !db.store.published) return null;
  const { id: _i, ...rest } = db.store;
  return {
    store: readStorefront("u1", rest),
    products: db.products.filter((p: any) => p.published).map((p: any) => { const { id: pid, ...f } = p; return readProduct(pid, f); }).sort((a: any, b: any) => a.name.localeCompare(b.name, "id")),
  };
}
export const newOrderId = (_store: string) => nextId("ord");
const asOrder = (o: any) => readOrder(o.id, { ...o, createdAt: { toDate: () => new Date(o.createdAt) }, steps: Object.fromEntries(Object.entries(o.steps ?? {}).map(([k, v]) => [k, { toDate: () => new Date(v as string) }])) });
export async function createOrderRequest(storeId: string, lines: any[], buyerName: string, buyerPhone: string, note: string, seen: string, orderId: string) {
  const existing = db.orders.find((x: any) => x.id === orderId);
  if (existing) return { id: orderId, order: asOrder(existing), existing: true as const };
  if (fault() === "before") { (globalThis as any).__fail = undefined; throw new Error("network"); }
  const latest = await getPublicCatalog(storeId);
  if (!latest) return { closed: true as const };
  const cart = reconcileCart(lines, latest.products);
  if (cart.length !== lines.length || orderSignature(latest.store, latest.products, cart) !== seen) return { changed: latest, cart };
  const request = orderRequestSchema.parse({ buyerName, note, items: orderItems(latest.products, cart) });
  const raw = { id: orderId, status: "pending", progress: "pending", ...request, buyerPhone, subtotal: orderSubtotal(request.items), trackingNo: "", sellerNote: "", shop: orderShopSnapshot(latest.store), steps: {}, createdAt: new Date().toISOString() };
  db.orders.push(raw);
  save();
  if (fault() === "after") { (globalThis as any).__fail = undefined; throw new Error("response lost"); }
  return { id: orderId, order: asOrder(raw), latest, cart };
}
export async function getOrderStatus(storeId: string, orderId: string) {
  const o = db.orders.find((x: any) => x.id === orderId);
  if (!o) return null;
  // Like the real reader: the order alone, never the storefront, so unpublished shops still track.
  const shop = o.shop ?? { name: "Toko", whatsapp: "", slug: "" };
  return { order: asOrder(o), shopName: shop.name, whatsapp: shop.whatsapp, slug: shop.slug, accent: db.store.published ? db.store.accent : undefined };
}
