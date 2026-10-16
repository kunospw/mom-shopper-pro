import { derive, isCancellationRefund, isRefund, normalizeSale, purchaseTotals } from "./books";
import { dayKey, inRange, monthKey, type DateRange } from "./period";
import type { Expense, Purchase, Sale } from "@/types/books";

/**
 * One place that turns recorded facts into report numbers, so Beranda,
 * Laporan and Penjualan cannot disagree. Definitions (see docs/accounting.md):
 *
 *   revenue      = totals of non-cancelled sales dated in the period
 *                  - refunds dated in the period on non-cancelled sales
 *   cogs         = unit cost x quantity of those sales' lines (never purchases)
 *   fees         = per-sale admin/packing fees, by sale date
 *   expenses     = expense records, by expense date
 *   purchaseShipping = freight on stock purchases, by the purchase's own date
 *   netProfit    = revenue - cogs - fees - expenses - purchaseShipping
 *   cash         = payments - refunds by their own dates, over ALL sales
 *                  (money that actually moved, including cancelled sales)
 *   outstandingNow / refundDueNow = as of now, independent of the period
 */
export interface Ledger {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
}

export interface Totals {
  revenueGross: number;
  returns: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  fees: number;
  expenses: number;
  purchaseShipping: number;
  operatingCosts: number;
  netProfit: number;
  cashReceived: number;
  cashRefunded: number;
  cashNet: number;
  purchaseSpend: number;
  purchaseGoods: number;
  salesCount: number;
}
export interface Bucket extends Totals {
  key: string;
  label: string;
  start: Date;
  end: Date;
}
export interface Report extends Totals {
  range: DateRange;
  /** Everything still owed by buyers on non-cancelled sales, as of now. */
  outstandingNow: number;
  /** Money still held on cancelled sales, as of now. */
  refundDueNow: number;
  buckets: Bucket[];
  customersOwing: number;
}

const zero = (): Totals => ({
  revenueGross: 0, returns: 0, revenue: 0, cogs: 0, grossProfit: 0, fees: 0,
  expenses: 0, purchaseShipping: 0, operatingCosts: 0, netProfit: 0,
  cashReceived: 0, cashRefunded: 0, cashNet: 0, purchaseSpend: 0,
  purchaseGoods: 0, salesCount: 0,
});

type Fact = {
  date: string;
  add: Partial<Record<keyof Totals, number>>;
};

/** Flatten the ledger into dated facts; every fact lands in exactly one bucket. */
function facts(ledger: Ledger): Fact[] {
  const out: Fact[] = [];
  for (const raw of ledger.sales) {
    const sale = derive(raw);
    const live = sale.fulfillment.status !== "cancelled";
    if (live)
      out.push({
        date: raw.date,
        add: { revenueGross: sale.total, cogs: sale.cost, fees: sale.fees, salesCount: 1 },
      });
    for (const p of raw.payments) {
      const amount = Number.isInteger(p.amount) && p.amount > 0 ? p.amount : 0;
      if (isRefund(p)) {
        out.push({
          date: p.date,
          add: { cashRefunded: amount, ...(live && !isCancellationRefund(p) ? { returns: amount } : {}) },
        });
      } else out.push({ date: p.date, add: { cashReceived: amount } });
    }
  }
  for (const e of ledger.expenses)
    out.push({ date: e.date, add: { expenses: Math.max(0, Math.round(e.amount) || 0) } });
  for (const p of ledger.purchases) {
    const t = purchaseTotals(p);
    out.push({
      date: p.date,
      add: { purchaseSpend: t.total, purchaseGoods: t.goods, purchaseShipping: t.shipping },
    });
  }
  return out;
}

function finish(t: Totals): Totals {
  t.revenue = t.revenueGross - t.returns;
  t.grossProfit = t.revenue - t.cogs;
  t.operatingCosts = t.fees + t.expenses + t.purchaseShipping;
  t.netProfit = t.grossProfit - t.operatingCosts;
  t.cashNet = t.cashReceived - t.cashRefunded;
  return t;
}
function accumulate(into: Totals, add: Fact["add"]) {
  for (const [k, v] of Object.entries(add) as [keyof Totals, number][]) into[k] += v;
}

const monthLabel = (d: Date) => d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
const dayLabel = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

/** Day buckets for ranges up to ~2 months, month buckets otherwise. */
export function bucketsFor(range: DateRange, dataStart?: Date, dataEnd?: Date) {
  let { start, end } = range;
  if (range.all) {
    if (!dataStart || !dataEnd) return [] as Omit<Bucket, keyof Totals>[];
    start = new Date(dataStart.getFullYear(), dataStart.getMonth(), 1);
    end = new Date(dataEnd.getFullYear(), dataEnd.getMonth() + 1, 1);
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const list: Omit<Bucket, keyof Totals>[] = [];
  if (!range.all && days <= 62) {
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      list.push({ key: dayKey(d), label: dayLabel(d), start: d, end: next });
    }
  } else {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      list.push({ key: monthKey(d), label: monthLabel(d), start: d, end: next });
    }
  }
  return list;
}

export function buildReport(ledger: Ledger, range: DateRange): Report {
  const all = facts(ledger);
  const times = all.map((f) => new Date(f.date).getTime()).filter(Number.isFinite);
  const dataStart = times.length ? new Date(Math.min(...times)) : undefined;
  const dataEnd = times.length ? new Date(Math.max(...times)) : undefined;

  const totals = zero();
  for (const f of all) if (inRange(f.date, range)) accumulate(totals, f.add);
  finish(totals);

  const buckets: Bucket[] = bucketsFor(range, dataStart, dataEnd).map((b) => {
    const t = zero();
    for (const f of all) if (inRange(f.date, { start: b.start, end: b.end })) accumulate(t, f.add);
    return { ...b, ...finish(t) };
  });

  const live = ledger.sales.map(normalizeSale);
  const owing = live.filter((s) => s.fulfillment.status !== "cancelled" && s.balance > 0);
  return {
    range,
    ...totals,
    outstandingNow: owing.reduce((s, x) => s + x.balance, 0),
    refundDueNow: live.reduce((s, x) => s + x.refundDue, 0),
    customersOwing: new Set(owing.map((s) => s.customerId || s.customer.name.trim().toLowerCase())).size,
    buckets,
  };
}

export interface ActivityItem {
  id: string;
  kind: "sale" | "payment" | "refund" | "purchase" | "expense";
  date: string;
  /** Signed for display: money in is positive, money out negative. */
  amount: number;
  title: string;
  detail: string;
}

/** Latest events across the ledger (for the "Transaksi terbaru" list). */
export function recentActivity(ledger: Ledger, limit = 8): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const raw of ledger.sales) {
    const s = normalizeSale(raw);
    if (s.fulfillment.status !== "cancelled")
      out.push({ id: `sale-${s.id}`, kind: "sale", date: s.date, amount: s.total, title: s.customer.name || "Pelanggan", detail: s.number });
    for (const p of s.payments)
      out.push({
        id: `pay-${s.id}-${p.id}`,
        kind: isRefund(p) ? "refund" : "payment",
        date: p.date,
        amount: isRefund(p) ? -p.amount : p.amount,
        title: s.customer.name || "Pelanggan",
        detail: `${isRefund(p) ? "Pengembalian dana" : "Pembayaran"} · ${s.number}`,
      });
  }
  for (const p of ledger.purchases)
    out.push({ id: `buy-${p.id}`, kind: "purchase", date: p.date, amount: -purchaseTotals(p).total, title: p.items[0]?.name || "Pembelian stok", detail: p.supplier || "Pembelian stok" });
  for (const e of ledger.expenses)
    out.push({ id: `exp-${e.id}`, kind: "expense", date: e.date, amount: -e.amount, title: e.category, detail: e.note || "Biaya usaha" });
  return out
    .filter((a) => Number.isFinite(new Date(a.date).getTime()))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** Stored-vs-recomputed mismatches, so stale derived data is visible instead of silently trusted. */
export interface IntegrityIssue {
  kind: "purchase-total" | "sale-derived";
  id: string;
  field: string;
  stored: number | undefined;
  computed: number;
}
export function ledgerIntegrity(ledger: Ledger): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const p of ledger.purchases) {
    const t = purchaseTotals(p);
    if (p.total !== t.total) issues.push({ kind: "purchase-total", id: p.id, field: "total", stored: p.total, computed: t.total });
  }
  for (const s of ledger.sales) {
    const d = derive(s);
    for (const field of ["total", "cost", "paid", "balance"] as const)
      if (s[field] !== d[field]) issues.push({ kind: "sale-derived", id: s.id, field, stored: s[field], computed: d[field] });
  }
  return issues;
}
