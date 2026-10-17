import { db, save, clone } from "./mockdb";
export const getOwnerOrders = async () => clone(db.orders).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
export async function rejectOrder(id: string, note: string) {
  const o = db.orders.find((x: any) => x.id === id);
  if (!o || o.status !== "pending") throw new Error("not pending");
  o.status = "rejected"; o.progress = "cancelled"; o.steps = { ...(o.steps ?? {}), cancelled: new Date().toISOString() }; o.sellerNote = note; save();
}
// Live listener stand-in: polls the mock db, so tests can push an order into __db.orders.
export function watchPendingOrders(onChange: (o: any[]) => void) {
  let last = "";
  const tick = () => {
    const pending = clone(db.orders.filter((o: any) => o.status === "pending"));
    const key = pending.map((o: any) => o.id).join(",");
    if (key !== last) { last = key; onChange(pending); }
  };
  tick();
  const timer = setInterval(tick, 400);
  return () => clearInterval(timer);
}
