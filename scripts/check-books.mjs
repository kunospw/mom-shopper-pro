import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/books.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const m = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const base = {
  date: "2026-10-05T10:00:00.000Z",
  channel: "manual",
  customer: { name: "Siti", whatsapp: "", address: "" },
  items: [
    { name: "Kemeja", option: "", kind: "physical", quantity: 2, unitPrice: 100000, unitCost: 60000, productId: "p1" },
    { name: "Voucher", option: "", kind: "digital", quantity: 1, unitPrice: 50000, unitCost: 40000 },
  ],
  shipping: 15000,
  discount: 10000,
  fees: 5000,
  payments: [],
  fulfillment: { status: "confirmed", courier: "", trackingNo: "", deliveryNote: "", updatedAt: "" },
  notes: "",
};
// totals, profit, balance
let s = m.derive(base);
assert.equal(s.subtotal, 250000);
assert.equal(s.total, 255000);
assert.equal(s.cost, 160000);
assert.equal(s.profit, 255000 - 160000 - 5000);
assert.equal(s.paymentState, "unpaid");
assert.equal(s.balance, 255000);
// DP -> partial, then full -> paid
const dp = m.newPayment(100000, "Transfer", base.date);
s = m.derive({ ...base, payments: [dp] });
assert.equal(s.paymentState, "partial");
assert.equal(s.balance, 155000);
s = m.derive({ ...base, payments: [dp, m.newPayment(155000, "Cash", base.date)] });
assert.equal(s.paymentState, "paid");
assert.equal(s.balance, 0);
// discount can't exceed order; bad numbers sanitised
s = m.derive({ ...base, discount: 9e9, shipping: -5, fees: NaN });
assert.equal(s.total, 0);
assert.equal(s.fees, 0);
assert.equal(s.shipping, 0);
// fulfillment flow
assert.equal(m.nextFulfillment("confirmed", false), "packed");
assert.equal(m.nextFulfillment("packed", false), "shipped");
assert.equal(m.nextFulfillment("shipped", false), "done");
assert.equal(m.nextFulfillment("confirmed", true), "delivered");
assert.equal(m.nextFulfillment("delivered", true), "done");
assert.equal(m.nextFulfillment("cancelled", false), null);
assert.equal(m.isAllDigital(base.items), false);
assert.equal(m.isAllDigital([base.items[1]]), true);
// stock deltas
assert.equal(m.saleStockDeltas(base.items).get("p1"), -2);
assert.equal(m.saleStockDeltas(base.items, 1).get("p1"), 2);
assert.equal(m.saleStockDeltas(base.items).size, 1);
assert.equal(m.purchaseStockDeltas([{ productId: "p1", name: "x", quantity: 5, unitCost: 1 }]).get("p1"), 5);
assert.equal(m.saleNumber("2026-10-05T10:00:00", 7), "INV-2610-007");
// legacy migration (idempotent: same id, same output)
const legacyPaid = { id: "a1", type: "sale", buyerName: "Budi", paymentStatus: "Paid", paymentMethod: "QRIS", date: base.date, notes: "", items: [{ productName: "Tas", quantity: 2, basePrice: 30000, sellingPrice: 50000, profit: 40000 }] };
let mg = m.migrateLegacy(legacyPaid);
assert.equal(mg.kind, "sale");
assert.equal(mg.sale.total, 100000);
assert.equal(mg.sale.paymentState, "paid");
assert.equal(mg.sale.payments.length, 1);
assert.deepEqual(m.migrateLegacy(legacyPaid), mg);
mg = m.migrateLegacy({ ...legacyPaid, id: "a2", paymentStatus: "Pending" });
assert.equal(mg.sale.paymentState, "unpaid");
const legacyFlat = { id: "a3", type: "sale", sellingPrice: 80000, basePrice: 50000, paymentStatus: "Pending", date: base.date, notes: "", productName: "Sepatu" };
mg = m.migrateLegacy(legacyFlat);
assert.equal(mg.sale.total, 80000);
assert.equal(mg.sale.cost, 50000);
const stock = m.migrateLegacy({ id: "s1", type: "stock", productName: "Kain", quantity: 3, basePrice: 20000, date: base.date, notes: "" });
assert.equal(stock.kind, "purchase");
assert.equal(stock.purchase.total, 60000);
// report: sales by sale date, cash by payment date, net after expenses
const oct = m.derive({ ...base, payments: [m.newPayment(100000, "Cash", "2026-11-02T00:00:00Z")] });
const sales = [{ ...oct, id: "1", number: "x" }, { ...m.derive({ ...base, fulfillment: { ...base.fulfillment, status: "cancelled" } }), id: "2", number: "y" }];
const exp = [{ id: "e", date: "2026-10-06", category: "iklan", amount: 20000, note: "" }];
const octSum = m.summarizeBooks(sales, [], exp, "2026-10");
assert.equal(octSum.sales, 255000); // cancelled sale excluded
assert.equal(octSum.received, 0); // payment was in November
assert.equal(octSum.netProfit, 90000 - 20000);
assert.equal(m.summarizeBooks(sales, [], exp, "2026-11").received, 100000);
assert.equal(m.summarizeBooks(sales, [], exp, "all").receivable, 155000);
// customer stats
const c = { id: "c1", name: "siti", whatsapp: "", address: "", note: "" };
const st = m.customerStats(c, sales);
assert.equal(st.orders, 1);
assert.equal(st.debt, 155000);
// WhatsApp update link
const wa = m.whatsAppUpdateLink({ ...s, number: "INV-2610-001", customer: { name: "Siti", whatsapp: "6281234567890", address: "" }, fulfillment: { status: "shipped", courier: "JNE", trackingNo: "123", deliveryNote: "", updatedAt: "" }, total: 100000, paid: 40000, balance: 60000 }, "Toko Melati");
assert(wa.startsWith("https://wa.me/6281234567890?text="));
const text = decodeURIComponent(wa.split("text=")[1]);
assert(text.includes("Resi: 123") && text.includes("Dikirim") && text.includes("Sisa tagihan"));
assert.equal(m.whatsAppUpdateLink({ ...s, customer: { name: "x", whatsapp: "", address: "" } }), null);
assert.equal(m.waNumber("+62 812-3456-7890"), "6281234567890");
assert.equal(m.waNumber("x/../evil?"), "");
assert.equal(m.waNumber("123"), "");
assert.equal(m.whatsAppUpdateLink({ ...s, customer: { name: "x", whatsapp: "abc/def", address: "" } }), null);
console.log("books model checks passed");
