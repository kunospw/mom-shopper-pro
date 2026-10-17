import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Every check runs under three time zones: a month boundary is a *local*
// boundary, and these three disagree about where it falls.
const ZONES = ["Asia/Jakarta", "UTC", "America/New_York"];
if (!process.env.CHECK_TZ) {
  for (const tz of ZONES) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, CHECK_TZ: tz },
      stdio: "inherit",
    });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
  console.log(`books/finance checks passed in ${ZONES.join(", ")}`);
  process.exit(0);
}
const TZ = process.env.CHECK_TZ;

const { build } = await import("esbuild");
async function load(file) {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(`../src/lib/${file}`, import.meta.url))],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
const m = await load("books.ts");
const r = await load("report.ts");
const p = await load("period.ts");

// ---------- helpers ----------
const at = (y, mo, d, h = 12, mi = 0, s = 0, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms).toISOString();
const baseInput = (over = {}) => ({
  date: at(2026, 10, 5),
  channel: "manual",
  customer: { name: "Siti", whatsapp: "", address: "" },
  items: [{ name: "Kemeja", option: "", kind: "physical", quantity: 2, unitPrice: 100000, unitCost: 60000, productId: "p1" }],
  shipping: 0,
  discount: 0,
  fees: 0,
  payments: [],
  fulfillment: { status: "confirmed", courier: "", trackingNo: "", deliveryNote: "", updatedAt: "" },
  notes: "",
  ...over,
});
const status = (input, st) => ({ ...input, fulfillment: { ...input.fulfillment, status: st } });
let n = 0;
const saleOf = (input) => ({ ...m.derive(input), id: `s${++n}`, number: `INV-${n}` });
const ledger = (sales = [], purchases = [], expenses = []) => ({ sales, purchases, expenses });
const pay = (input, amount, date = at(2026, 10, 6), method = "Transfer", extra = {}) =>
  m.applyPayment(input, { kind: "payment", amount, method, date, ...extra });
const refund = (input, amount, date = at(2026, 10, 20), extra = {}) =>
  m.applyPayment(input, { kind: "refund", amount, method: "Transfer", date, ...extra });
const throwsLedger = (fn, code) => {
  try {
    fn();
  } catch (e) {
    assert.equal(e.name, "LedgerError", String(e));
    if (code) assert(e.issues.some((i) => i.code === code), `${code} in ${JSON.stringify(e.issues)}`);
    return;
  }
  assert.fail("expected LedgerError");
};
const month = (y, mo) => ({ start: new Date(y, mo - 1, 1), end: new Date(y, mo, 1) });
const ALL = p.ALL_TIME;

// ---------- 1. derive basics (unchanged behavior) ----------
{
  const base = baseInput({
    items: [
      { name: "Kemeja", option: "", kind: "physical", quantity: 2, unitPrice: 100000, unitCost: 60000, productId: "p1" },
      { name: "Voucher", option: "", kind: "digital", quantity: 1, unitPrice: 50000, unitCost: 40000 },
    ],
    shipping: 15000,
    discount: 10000,
    fees: 5000,
  });
  let s = m.derive(base);
  assert.equal(s.subtotal, 250000);
  assert.equal(s.total, 255000);
  assert.equal(s.cost, 160000);
  assert.equal(s.profit, 255000 - 160000 - 5000);
  assert.equal(s.paymentState, "unpaid");
  assert.equal(s.balance, 255000);
  const dp = m.newPayment(100000, "Transfer", base.date);
  s = m.derive({ ...base, payments: [dp] });
  assert.equal(s.paymentState, "partial");
  assert.equal(s.balance, 155000);
  s = m.derive({ ...base, payments: [dp, m.newPayment(155000, "Cash", base.date)] });
  assert.equal(s.paymentState, "paid");
  assert.equal(s.balance, 0);
  // discount cannot exceed the order; bad numbers are sanitised
  s = m.derive({ ...base, discount: 9e9, shipping: -5, fees: NaN });
  assert.equal(s.total, 0);
  assert.equal(s.fees, 0);
  assert.equal(s.shipping, 0);
  assert.equal(m.nextFulfillment("confirmed", false), "packed");
  assert.equal(m.nextFulfillment("shipped", false), "done");
  assert.equal(m.nextFulfillment("confirmed", true), "delivered");
  assert.equal(m.nextFulfillment("cancelled", false), null);
  assert.equal(m.saleStockDeltas(base.items).get("p1"), -2);
  assert.equal(m.saleNumber("2026-10-05T10:00:00", 7), "INV-2610-007");
}

// ---------- 2. payments are strict: no silent clamping ----------
for (const bad of [0, -1, -50000, 1.5, NaN, Infinity, "100"]) {
  assert.throws(() => m.newPayment(bad, "Cash", at(2026, 10, 1)), RangeError, `payment ${bad}`);
  assert.throws(() => m.newRefund(bad, "Cash", at(2026, 10, 1)), RangeError, `refund ${bad}`);
}
assert.throws(() => m.newPayment(1000, "Cash", "not-a-date"), RangeError);
assert.equal(m.newPayment(1000, "Cash", at(2026, 10, 1)).kind, undefined, "legacy shape: no kind on payments");
assert.equal(m.newRefund(1000, "Cash", at(2026, 10, 1)).kind, "refund");
assert.equal(m.newRefund(1000, "Cash", at(2026, 10, 1)).reason, "return");
// the ledger gate rejects hand-built bad data too
{
  const total = 200000;
  const ok = (payments, cancelled = false) => m.validatePayments(payments, { total, cancelled });
  const P = (amount, over = {}) => ({ id: `x${Math.random()}`, amount, method: "Cash", date: at(2026, 10, 6), note: "", ...over });
  assert.deepEqual(ok([P(100000)]), []);
  assert.equal(ok([P(-5)])[0].code, "invalid-amount");
  assert.equal(ok([P(0)])[0].code, "invalid-amount");
  assert.equal(ok([P(10.5)])[0].code, "invalid-amount");
  assert.equal(ok([P(1000, { kind: "gift" })])[0].code, "invalid-kind");
  assert.equal(ok([P(1000, { method: "Bitcoin" })])[0].code, "invalid-method");
  assert.equal(ok([P(1000, { date: "nope" })])[0].code, "invalid-date");
  assert.equal(ok([P(1000, { reason: "return" })])[0].code, "invalid-reason", "reason only on refunds");
  assert.equal(ok([P(1000, { kind: "refund", reason: "weird" })])[0].code, "invalid-reason");
  assert.equal(ok([P(300000)])[0].code, "overpaid");
  assert.deepEqual(ok([P(300000)], true), [], "cancelled sales have no payment cap");
}

// ---------- 3. refunds: validation, partial, full, cumulative ----------
{
  const unpaid = baseInput(); // total 200000
  throwsLedger(() => refund(unpaid, 1000), "refund-exceeds-paid"); // refund on an unpaid sale

  const paid = pay(unpaid, 200000);
  // partial refund
  let after = refund(paid, 50000);
  let d = m.derive(after);
  assert.equal(d.paid, 150000);
  assert.equal(d.refunded, 50000);
  assert.equal(d.returned, 50000);
  assert.equal(d.balance, 0, "a sales return does not re-open the receivable");
  assert.equal(d.paymentState, "paid");
  // cumulative partials up to exactly the net paid, then one more is rejected
  after = refund(after, 100000);
  after = refund(after, 50000);
  d = m.derive(after);
  assert.equal(d.paid, 0);
  assert.equal(d.refunded, 200000);
  throwsLedger(() => refund(after, 1), "refund-exceeds-paid");
  // a single refund larger than net paid is rejected
  throwsLedger(() => refund(paid, 200001), "refund-exceeds-paid");
  // refund dated before the first payment is rejected
  throwsLedger(() => refund(pay(unpaid, 100000, at(2026, 10, 10)), 1000, at(2026, 10, 9)), "refund-before-payment");
  // partial payment then refund within what was paid
  const dp = pay(unpaid, 80000);
  assert.equal(m.derive(refund(dp, 30000)).balance, 120000, "balance still total - gross payments");
  throwsLedger(() => refund(dp, 80001), "refund-exceeds-paid");
  // overpaying an active sale is rejected, refunds do not create room to overpay
  throwsLedger(() => pay(paid, 1), "overpaid");
  throwsLedger(() => pay(refund(paid, 50000), 1), "overpaid");
  // legacy payments (no kind/reason) still behave as plain payments
  const legacy = m.derive(baseInput({ payments: [{ id: "l", amount: 200000, method: "QRIS", date: at(2026, 10, 6), note: "" }] }));
  assert.equal(legacy.paid, 200000);
  assert.equal(legacy.refunded, 0);
  assert.equal(legacy.paymentState, "paid");
  // reports: a return reduces revenue in the REFUND month, not the sale month
  const oct = saleOf(refund(paid, 50000, at(2026, 11, 3)));
  const rOct = r.buildReport(ledger([oct]), month(2026, 10));
  const rNov = r.buildReport(ledger([oct]), month(2026, 11));
  assert.equal(rOct.revenue, 200000);
  assert.equal(rNov.revenue, -50000);
  assert.equal(rNov.returns, 50000);
  assert.equal(rOct.cashNet, 200000);
  assert.equal(rNov.cashNet, -50000);
  assert.equal(r.buildReport(ledger([oct]), ALL).revenue, 150000);
  assert.equal(r.buildReport(ledger([oct]), ALL).cashNet, 150000);
}

// ---------- 4. cancelled sales ----------
{
  const total = 200000;
  const withDp = pay(baseInput(), 80000); // active, DP held
  const cancelled = status(withDp, "cancelled");
  let d = m.derive(cancelled);
  assert.equal(d.balance, 0);
  assert.equal(d.refundDue, 80000);
  assert.equal(d.paid, 80000);
  let rep = r.buildReport(ledger([saleOf(cancelled)]), ALL);
  assert.equal(rep.revenue, 0);
  assert.equal(rep.cogs, 0);
  assert.equal(rep.fees, 0);
  assert.equal(rep.cashNet, 80000, "money actually received still counts as cash");
  assert.equal(rep.outstandingNow, 0);
  assert.equal(rep.refundDueNow, 80000);
  assert.equal(rep.salesCount, 0);
  // partial refund of the held DP after cancelling
  const half = refund(cancelled, 30000);
  assert.equal(half.payments.at(-1).reason, "cancellation", "reason follows the sale's state");
  d = m.derive(half);
  assert.equal(d.refundDue, 50000);
  rep = r.buildReport(ledger([saleOf(half)]), ALL);
  assert.equal(rep.cashNet, 50000);
  assert.equal(rep.returns, 0, "cancellation refunds are cash only");
  assert.equal(rep.revenue, 0);
  // full refund
  const full = refund(half, 50000);
  d = m.derive(full);
  assert.equal(d.refundDue, 0);
  assert.equal(d.paid, 0);
  rep = r.buildReport(ledger([saleOf(full)]), ALL);
  assert.equal(rep.cashNet, 0);
  assert.equal(rep.cashReceived, 80000);
  assert.equal(rep.cashRefunded, 80000);
  assert.equal(rep.refundDueNow, 0);
  throwsLedger(() => refund(full, 1), "refund-exceeds-paid");
  // cancel -> refund everything -> re-open: the buyer owes the amount again
  const reopened = status(full, "confirmed");
  d = m.derive(reopened);
  assert.equal(d.paid, 0);
  assert.equal(d.balance, total, "refunded money no longer counts toward the sale");
  assert.equal(d.paymentState, "unpaid");
  assert.equal(r.buildReport(ledger([saleOf(reopened)]), ALL).revenue, total);
  // cancel with no payments, cancelled sale with payment + refund keeps working with report dates
  const lateRefund = refund(cancelled, 80000, at(2026, 12, 2));
  assert.equal(r.buildReport(ledger([saleOf(lateRefund)]), month(2026, 12)).cashNet, -80000);
  assert.equal(r.buildReport(ledger([saleOf(lateRefund)]), month(2026, 10)).cashNet, 80000);
  // an active sale refunded as a return and then cancelled: cash only from then on
  const returned = refund(pay(baseInput(), 200000), 50000);
  const thenCancelled = status(returned, "cancelled");
  rep = r.buildReport(ledger([saleOf(thenCancelled)]), ALL);
  assert.equal(rep.revenue, 0);
  assert.equal(rep.returns, 0);
  assert.equal(rep.cashNet, 150000);
  assert.equal(m.derive(thenCancelled).refundDue, 150000);
  // the storage gate validates before any write
  throwsLedger(() => m.assertValidSale({ ...baseInput(), payments: [m.newRefund(5, "Cash", at(2026, 10, 6))] }), "refund-exceeds-paid");
}

// ---------- 5. purchase shipping: recorded on the purchase's own date ----------
{
  const purchase = (date, qty, unitCost, shipping, extra = {}) => ({
    id: `b${++n}`, date, supplier: "", items: [{ name: "Kain", quantity: qty, unitCost }], shipping,
    total: qty * unitCost + shipping, notes: "", ...extra,
  });
  const octBuy = purchase(at(2026, 10, 28), 10, 20000, 30000);
  const novSale = saleOf(baseInput({ date: at(2026, 11, 10) })); // the stock is sold a month later
  const L = ledger([novSale], [octBuy]);
  const oct = r.buildReport(L, month(2026, 10));
  const nov = r.buildReport(L, month(2026, 11));
  assert.equal(oct.purchaseShipping, 30000, "freight is a cost in the month it was paid");
  assert.equal(nov.purchaseShipping, 0, "selling the stock later does not move it");
  assert.equal(oct.purchaseSpend, 230000);
  assert.equal(oct.purchaseGoods, 200000);
  assert.equal(oct.cogs, 0, "purchases are never subtracted in addition to COGS");
  assert.equal(oct.netProfit, -30000);
  assert.equal(nov.cogs, 120000);
  assert.equal(nov.netProfit, 200000 - 120000);
  assert.equal(r.buildReport(L, ALL).netProfit, 200000 - 120000 - 30000);
  // month boundaries are LOCAL instants
  const lastMs = purchase(at(2026, 10, 31, 23, 59, 59, 999), 1, 1000, 500);
  const firstMs = purchase(at(2026, 11, 1, 0, 0, 0, 0), 1, 1000, 700);
  const B = ledger([], [lastMs, firstMs]);
  assert.equal(r.buildReport(B, month(2026, 10)).purchaseShipping, 500);
  assert.equal(r.buildReport(B, month(2026, 11)).purchaseShipping, 700);
  // an instant that is 1 Nov in Jakarta but still 31 Oct in UTC / New York
  const edge = purchase("2026-10-31T17:00:00.000Z", 1, 1000, 900);
  const E = ledger([], [edge]);
  const octEdge = r.buildReport(E, month(2026, 10)).purchaseShipping;
  const novEdge = r.buildReport(E, month(2026, 11)).purchaseShipping;
  if (TZ === "Asia/Jakarta") assert.deepEqual([octEdge, novEdge], [0, 900]);
  else assert.deepEqual([octEdge, novEdge], [900, 0]);
  // zero shipping and missing shipping
  assert.equal(r.buildReport(ledger([], [purchase(at(2026, 10, 3), 2, 5000, 0)]), month(2026, 10)).purchaseShipping, 0);
  const noField = purchase(at(2026, 10, 3), 2, 5000, 0);
  delete noField.shipping;
  assert.equal(r.buildReport(ledger([], [noField]), month(2026, 10)).purchaseShipping, 0);
  // reports use the RECORDED lines, not a stale stored total; the mismatch is surfaced
  const stale = purchase(at(2026, 10, 3), 2, 5000, 1000, { total: 999999 });
  assert.equal(m.purchaseTotals(stale).total, 11000);
  assert.equal(r.buildReport(ledger([], [stale]), month(2026, 10)).purchaseSpend, 11000);
  assert.deepEqual(r.ledgerIntegrity(ledger([], [stale])).map((i) => [i.kind, i.field, i.stored, i.computed]), [["purchase-total", "total", 999999, 11000]]);
  assert.deepEqual(r.ledgerIntegrity(ledger([], [octBuy])), []);
  // legacy `stock` entries migrate with shipping 0 and total = quantity x base price
  const mig = m.migrateLegacy({ id: "s1", type: "stock", productName: "Kain", quantity: 3, basePrice: 20000, date: at(2026, 10, 7), notes: "" });
  assert.equal(mig.purchase.shipping, 0);
  assert.equal(m.purchaseTotals(mig.purchase).total, 60000);
  assert.deepEqual(r.ledgerIntegrity(ledger([], [mig.purchase])), []);
  // an expense and purchase shipping both count (the owner must not enter the same freight twice: documented)
  const both = r.buildReport(ledger([], [octBuy], [{ id: "e", date: at(2026, 10, 29), category: "ongkir", amount: 8000, note: "" }]), month(2026, 10));
  assert.equal(both.operatingCosts, 38000);
}

// ---------- 6. local-time period API ----------
{
  const jan = p.periodRange("this-month", new Date(2026, 0, 31, 23, 0));
  assert.equal(jan.start.getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(jan.end.getTime(), new Date(2026, 1, 1).getTime());
  assert(p.inRange(new Date(2026, 0, 1, 0, 0, 0, 0).toISOString(), jan), "start is inclusive");
  assert(!p.inRange(new Date(2026, 1, 1, 0, 0, 0, 0).toISOString(), jan), "end is exclusive");
  assert(p.inRange(new Date(2026, 0, 31, 23, 59, 59, 999).toISOString(), jan));
  assert(!p.inRange("garbage", jan));
  // the old bug: slicing the UTC string disagrees with the local calendar
  const earlyNov = new Date(2026, 10, 1, 3, 0).toISOString();
  assert.equal(p.monthKey(earlyNov), "2026-11");
  if (TZ === "Asia/Jakarta") assert.equal(earlyNov.slice(0, 7), "2026-10", "this is the bug the local API fixes");
  // previous period: calendar months shift by months, other ranges by their length
  const mar = p.periodRange("this-month", new Date(2026, 2, 10));
  const prev = p.previousRange(mar);
  assert.equal(prev.start.getTime(), new Date(2026, 1, 1).getTime());
  assert.equal(prev.end.getTime(), new Date(2026, 2, 1).getTime());
  const q = p.previousRange(p.periodRange("last-3-months", new Date(2026, 4, 10)));
  assert.equal(q.start.getTime(), new Date(2025, 11, 1).getTime());
  assert.equal(q.end.getTime(), new Date(2026, 2, 1).getTime());
  const w = p.previousRange(p.periodRange("7-days", new Date(2026, 4, 10)));
  assert.equal(w.end.getTime(), new Date(2026, 4, 4).getTime());
  assert.equal(p.previousRange(p.ALL_TIME), null);
  // custom ranges are inclusive calendar days
  const c = p.customRange("2026-10-05", "2026-10-05");
  assert.equal(c.end.getTime() - c.start.getTime(), 86_400_000 * (TZ === "America/New_York" ? 1 : 1));
  assert.equal(p.customRange("2026-10-06", "2026-10-05"), null);
  assert.equal(p.customRange("2026-02-30", "2026-03-01"), null);
  // date-only inputs are stored at LOCAL noon
  const iso = p.localDateToISO("2026-10-01");
  assert.equal(p.dayKey(iso), "2026-10-01");
  assert.equal(p.monthKey(iso), "2026-10");
  assert.throws(() => p.localDateToISO("2026-13-01"), RangeError);
  if (TZ === "America/New_York") assert.equal(p.dayKey(new Date("2026-10-01").toISOString()), "2026-09-30", "UTC-midnight parsing shifts the day here");
  assert.equal(p.localToday(new Date(2026, 9, 17, 6, 0)), "2026-10-17");
  // buckets cover the range exactly
  const bk = r.bucketsFor(p.periodRange("this-year", new Date(2026, 5, 1)));
  assert.equal(bk.length, 12);
  assert.equal(r.bucketsFor(p.periodRange("this-month", new Date(2026, 1, 9))).length, 28);
  assert.equal(r.bucketsFor(p.periodRange("7-days", new Date(2026, 5, 9))).length, 7);
}

// ---------- 7. report definitions and reconciliation ----------
{
  const one = saleOf(baseInput({ shipping: 10000, discount: 5000, fees: 3000, date: at(2026, 10, 5) }));
  const withPay = saleOf(pay(baseInput({ shipping: 10000, discount: 5000, fees: 3000 }), 100000, at(2026, 11, 2)));
  const exp = { id: "e1", date: at(2026, 10, 12), category: "iklan", amount: 20000, note: "" };
  const buy = { id: "b1", date: at(2026, 10, 20), supplier: "", items: [{ name: "x", quantity: 1, unitCost: 50000 }], shipping: 7000, total: 57000, notes: "" };
  const rep = r.buildReport(ledger([one], [buy], [exp]), month(2026, 10));
  assert.equal(rep.revenueGross, 205000);
  assert.equal(rep.cogs, 120000);
  assert.equal(rep.fees, 3000);
  assert.equal(rep.expenses, 20000);
  assert.equal(rep.purchaseShipping, 7000);
  assert.equal(rep.operatingCosts, 30000);
  assert.equal(rep.netProfit, 205000 - 120000 - 3000 - 20000 - 7000);
  assert.equal(rep.netProfit, rep.revenue - rep.cogs - rep.fees - rep.expenses - rep.purchaseShipping);
  // sales by sale date, cash by payment date
  const L = ledger([withPay]);
  assert.equal(r.buildReport(L, month(2026, 10)).revenue, 205000);
  assert.equal(r.buildReport(L, month(2026, 10)).cashNet, 0);
  assert.equal(r.buildReport(L, month(2026, 11)).revenue, 0);
  assert.equal(r.buildReport(L, month(2026, 11)).cashNet, 100000);
  // outstanding is as-of-now and ignores the period
  assert.equal(r.buildReport(L, month(2026, 10)).outstandingNow, 105000);
  assert.equal(r.buildReport(L, month(2026, 1)).outstandingNow, 105000);
  assert.equal(r.buildReport(L, month(2026, 10)).customersOwing, 1);
  // stale stored derived fields are ignored: reports re-derive from the facts
  const tampered = { ...one, total: 1, cost: 1, balance: 1, paid: 999999 };
  assert.equal(r.buildReport(ledger([tampered]), ALL).revenue, 205000);
  assert(r.ledgerIntegrity(ledger([tampered])).length >= 3);
  // customer stats use re-derived values and net of returns
  const cust = { id: "c1", name: "siti", whatsapp: "", address: "", note: "" };
  const st = m.customerStats(cust, [saleOf(refund(pay(baseInput(), 200000), 50000)), saleOf(status(baseInput(), "cancelled"))]);
  assert.equal(st.orders, 1);
  assert.equal(st.spent, 150000);
  assert.equal(st.debt, 0);
  // recent activity mixes sales, payments, refunds, purchases, expenses newest first
  const act = r.recentActivity(ledger([saleOf(refund(pay(baseInput(), 200000, at(2026, 10, 6)), 50000, at(2026, 10, 9)))], [buy], [exp]), 10);
  assert.deepEqual(act.map((a) => a.kind), ["purchase", "expense", "refund", "payment", "sale"]);
  assert.equal(act.find((a) => a.kind === "refund").amount, -50000);
}

// ---------- 8. WhatsApp helpers and legacy migration (unchanged behavior) ----------
{
  const s = saleOf(baseInput({ customer: { name: "Siti", whatsapp: "6281234567890", address: "" }, fulfillment: { status: "shipped", courier: "JNE", trackingNo: "123", deliveryNote: "", updatedAt: "" } }));
  const wa = m.whatsAppUpdateLink(s, "Toko Melati");
  assert(wa.startsWith("https://wa.me/6281234567890?text="));
  const text = decodeURIComponent(wa.split("text=")[1]);
  assert(text.includes("Resi: 123") && text.includes("Dikirim") && text.includes("Sisa tagihan"));
  assert.equal(m.waNumber("+62 812-3456-7890"), "6281234567890");
  assert.equal(m.waNumber("x/../evil?"), "");
  const legacyPaid = { id: "a1", type: "sale", buyerName: "Budi", paymentStatus: "Paid", paymentMethod: "QRIS", date: at(2026, 10, 5), notes: "", items: [{ productName: "Tas", quantity: 2, basePrice: 30000, sellingPrice: 50000, profit: 40000 }] };
  const mg = m.migrateLegacy(legacyPaid);
  assert.equal(mg.sale.total, 100000);
  assert.equal(mg.sale.paymentState, "paid");
  assert.equal(mg.sale.payments[0].kind, undefined);
  assert.deepEqual(m.migrateLegacy(legacyPaid), mg, "idempotent");
  assert.equal(m.migrateLegacy({ ...legacyPaid, id: "a2", paymentStatus: "Pending" }).sale.paymentState, "unpaid");
  const flat = m.migrateLegacy({ id: "a3", type: "sale", sellingPrice: 80000, basePrice: 50000, paymentStatus: "Pending", date: at(2026, 10, 5), notes: "", productName: "Sepatu" });
  assert.equal(flat.sale.total, 80000);
  assert.equal(flat.sale.cost, 50000);
}

// ---------- 9. randomized reconciliation against an independent oracle ----------
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomLedger(seed) {
  const rand = rng(seed);
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const t0 = new Date(2025, 0, 1).getTime();
  const DAY = 86_400_000;
  const when = (ms) => new Date(ms).toISOString();
  const sales = [];
  for (let i = 0; i < 30; i++) {
    const saleMs = t0 + int(0, 700) * DAY + int(0, 86_399) * 1000;
    let input = baseInput({
      date: when(saleMs),
      items: Array.from({ length: int(1, 3) }, (_, k) => ({ name: `P${k}`, option: "", kind: "physical", quantity: int(1, 4), unitPrice: int(1, 50) * 1000, unitCost: int(0, 40) * 1000 })),
      shipping: int(0, 3) * 5000,
      discount: int(0, 2) * 5000,
      fees: int(0, 2) * 2000,
    });
    let cursor = saleMs + int(0, 10) * DAY;
    const cancelEarly = rand() < 0.1;
    if (cancelEarly) input = status(input, "cancelled");
    for (let k = int(0, 5); k > 0; k--) {
      const d = m.derive(input);
      const cancelled = input.fulfillment.status === "cancelled";
      cursor += int(0, 20) * DAY + int(1, 80_000) * 1000;
      const held = d.paidGross - input.payments.filter((q) => q.kind === "refund" && q.reason === "cancellation").reduce((a, q) => a + q.amount, 0);
      const room = cancelled ? int(1, 100000) : d.total - held;
      if (rand() < 0.65 && room > 0) input = pay(input, int(1, Math.min(room, 400000)), when(cursor));
      else if (d.paid > 0) input = refund(input, int(1, d.paid), when(cursor));
    }
    if (!cancelEarly && rand() < 0.2) input = status(input, "cancelled");
    sales.push(saleOf(input));
  }
  const purchases = Array.from({ length: 10 }, (_, i) => {
    const items = [{ name: "x", quantity: int(1, 5), unitCost: int(1, 30) * 1000 }];
    const shipping = int(0, 3) * 4000;
    return { id: `rb${i}`, date: when(t0 + int(0, 700) * DAY + int(0, 86_399) * 1000), supplier: "", items, shipping, total: items[0].quantity * items[0].unitCost + shipping, notes: "" };
  });
  const expenses = Array.from({ length: 10 }, (_, i) => ({ id: `re${i}`, date: when(t0 + int(0, 700) * DAY + int(0, 86_399) * 1000), category: "iklan", amount: int(1, 20) * 1000, note: "" }));
  return ledger(sales, purchases, expenses);
}
function oracle(L, y, mo) {
  const inM = (iso) => {
    const d = new Date(iso);
    return d.getFullYear() === y && d.getMonth() === mo;
  };
  const o = { revenue: 0, cogs: 0, fees: 0, expenses: 0, ship: 0, spend: 0, cash: 0 };
  let gross = 0;
  let returns = 0;
  for (const s of L.sales) {
    const sub = s.items.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    const total = sub + s.shipping - Math.min(s.discount, sub + s.shipping);
    const cost = s.items.reduce((a, i) => a + i.unitCost * i.quantity, 0);
    const live = s.fulfillment.status !== "cancelled";
    if (live && inM(s.date)) {
      gross += total;
      o.cogs += cost;
      o.fees += s.fees;
    }
    for (const q of s.payments) {
      if (!inM(q.date)) continue;
      if (q.kind === "refund") {
        o.cash -= q.amount;
        if (live && q.reason !== "cancellation") returns += q.amount;
      } else o.cash += q.amount;
    }
  }
  o.revenue = gross - returns;
  for (const e of L.expenses) if (inM(e.date)) o.expenses += e.amount;
  for (const b of L.purchases)
    if (inM(b.date)) {
      o.ship += b.shipping;
      o.spend += b.items.reduce((a, i) => a + i.quantity * i.unitCost, 0) + b.shipping;
    }
  o.net = o.revenue - o.cogs - o.fees - o.expenses - o.ship;
  return o;
}
{
  let ledgers = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const L = randomLedger(seed);
    ledgers++;
    // every derived sale is sane
    for (const s of L.sales) {
      assert(s.balance >= 0 && s.paid >= 0 && s.refundDue >= 0 && s.credit >= 0, `seed ${seed} sane`);
      assert.deepEqual(m.validatePayments(s.payments, { total: s.total, cancelled: s.fulfillment.status === "cancelled" }), [], `seed ${seed} valid`);
    }
    const sums = { revenue: 0, cogs: 0, fees: 0, expenses: 0, purchaseShipping: 0, purchaseSpend: 0, cashNet: 0, netProfit: 0 };
    for (let k = 0; k < 36; k++) {
      const y = 2025 + Math.floor(k / 12);
      const mo = k % 12;
      const got = r.buildReport(L, month(y, mo + 1));
      const want = oracle(L, y, mo);
      assert.equal(got.revenue, want.revenue, `seed ${seed} ${y}-${mo + 1} revenue`);
      assert.equal(got.cogs, want.cogs, `seed ${seed} cogs`);
      assert.equal(got.fees, want.fees, `seed ${seed} fees`);
      assert.equal(got.expenses, want.expenses, `seed ${seed} expenses`);
      assert.equal(got.purchaseShipping, want.ship, `seed ${seed} shipping`);
      assert.equal(got.purchaseSpend, want.spend, `seed ${seed} spend`);
      assert.equal(got.cashNet, want.cash, `seed ${seed} cash`);
      assert.equal(got.netProfit, want.net, `seed ${seed} net`);
      assert.equal(got.netProfit, got.revenue - got.cogs - got.fees - got.expenses - got.purchaseShipping);
      for (const key of Object.keys(sums)) sums[key] += got[key];
    }
    // months add up to all time; the daily/monthly series add up to the totals
    const all = r.buildReport(L, ALL);
    for (const key of Object.keys(sums)) assert.equal(sums[key], all[key], `seed ${seed} additivity ${key}`);
    for (const key of ["revenue", "cogs", "netProfit", "cashNet"]) assert.equal(all.buckets.reduce((a, b) => a + b[key], 0), all[key], `seed ${seed} series ${key}`);
    const year = r.buildReport(L, p.periodRange("this-year", new Date(2026, 5, 1)));
    assert.equal(year.buckets.reduce((a, b) => a + b.netProfit, 0), year.netProfit);
    // outstanding does not depend on the period
    assert.equal(r.buildReport(L, month(2025, 3)).outstandingNow, all.outstandingNow);
    // cash over all time equals every payment minus every refund, cancelled sales included
    const cash = L.sales.flatMap((s) => s.payments).reduce((a, q) => a + (q.kind === "refund" ? -q.amount : q.amount), 0);
    assert.equal(all.cashNet, cash);
    // an invalid refund is always rejected
    const withMoney = L.sales.find((s) => s.paid > 0);
    if (withMoney) throwsLedger(() => refund(withMoney, withMoney.paid + 1, at(2027, 1, 1)), "refund-exceeds-paid");
  }
  console.log(`  ${TZ}: ${ledgers} randomized ledgers reconciled`);
}

console.log(`books model checks passed (${TZ})`);
