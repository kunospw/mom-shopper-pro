const KEY = "__mockdb_v1";
const mk = (id: string, over: any) => ({ id, description: "", category: "", price: 0, image: "", availability: "ready", leadTime: "", optionLabel: "Pilihan", options: [], kind: "physical", published: true, ...over });
const seed = () => ({
  sales: [] as any[], purchases: [] as any[], expenses: [] as any[], customers: [] as any[],
  inventory: { p1: { cost: 100000, stock: 5 } } as Record<string, any>,
  orders: [] as any[],
  entitlement: null as null | { trialStartedAt: string; paidUntil: string | null },
  store: { id: "u1", name: "Toko Melati", description: "Produk pilihan", whatsapp: "6281234567890", accent: "teal", logo: "", published: true, slug: "tokomelati" } as any,
  slugs: { tokomelati: "u1" } as Record<string, string>,
  products: [
    mk("p1", { name: "Kemeja Linen", price: 150000, category: "Pakaian", optionLabel: "Warna", options: [{ label: "Hitam", price: 0 }, { label: "Putih", price: 160000 }] }),
    mk("p2", { name: "Voucher Game", price: 50000, category: "Digital", kind: "digital" }),
    mk("p3", { name: "Tas Rajut", price: 200000, category: "Pakaian", availability: "preorder", leadTime: "7 hari" }),
    mk("p4", { name: "Produk Draft", price: 10000, published: false }),
  ] as any[],
});
let state: any;
try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { state = null; }
if (!state) state = seed();
export const db = state;
(globalThis as any).__db = db;
export const save = () => localStorage.setItem(KEY, JSON.stringify(db));
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let n = Date.now();
export const nextId = (p: string) => `${p}${(n++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
