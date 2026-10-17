import type {
  Customer,
  Expense,
  FulfillmentStatus,
  Payment,
  PaymentState,
  Purchase,
  Sale,
  SaleInput,
  SaleItem,
} from "@/types/books";
import type { Transaction } from "@/types/transaction";
import { formatRupiah } from "./currency";

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

/** Amount of a stored payment as a safe non-negative integer (never throws). */
const paymentAmount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};
export const isRefund = (p: Pick<Payment, "kind">) => p.kind === "refund";
/** A refund that only returns money held on a cancelled sale. */
export const isCancellationRefund = (p: Pick<Payment, "kind" | "reason">) =>
  isRefund(p) && p.reason === "cancellation";
export const paymentMethods = ["QRIS", "Transfer", "Cash", "EWallet"] as const;

export type DerivedSale = Omit<Sale, "id" | "number">;

/**
 * Recompute every derived field from the recorded facts. Payments and refunds
 * are summed as recorded (never clamped here; `validatePayments` is the gate).
 * A refund on an active sale is a sales return: it lowers revenue (in the
 * month of the refund) and cash but does not re-open the receivable.
 */
export function derive(input: SaleInput): DerivedSale {
  const items = input.items.map((item) => ({
    ...item,
    quantity: Math.max(1, Math.round(item.quantity) || 1),
    unitPrice: money(item.unitPrice),
    unitCost: money(item.unitCost),
  }));
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const shipping = money(input.shipping);
  const discount = Math.min(money(input.discount), subtotal + shipping);
  const fees = money(input.fees);
  const total = subtotal + shipping - discount;
  const cancelled = input.fulfillment.status === "cancelled";
  const paidGross = input.payments
    .filter((p) => !isRefund(p))
    .reduce((s, p) => s + paymentAmount(p.amount), 0);
  const refunded = input.payments
    .filter(isRefund)
    .reduce((s, p) => s + paymentAmount(p.amount), 0);
  const returnedByCancel = input.payments
    .filter(isCancellationRefund)
    .reduce((s, p) => s + paymentAmount(p.amount), 0);
  const returned = refunded - returnedByCancel;
  const paid = paidGross - refunded;
  // Money that still counts toward this sale: a sales return does not re-open
  // the receivable, a refund of a cancelled sale does (if it is re-opened).
  const held = paidGross - returnedByCancel;
  const balance = cancelled ? 0 : Math.max(0, total - held);
  const paymentState: PaymentState =
    total === 0 && held === 0
      ? "paid"
      : total > 0 && held >= total
        ? "paid"
        : held > 0
          ? "partial"
          : "unpaid";
  return {
    ...input,
    items,
    shipping,
    discount,
    fees,
    subtotal,
    total,
    cost,
    // Shipping is charged to the buyer; fees (admin/packing) are the seller's cost.
    // Refunds on an active sale are a return of revenue.
    profit: total - returned - cost - fees,
    paidGross,
    refunded,
    returned,
    paid,
    balance,
    refundDue: cancelled ? Math.max(0, paid) : 0,
    credit: cancelled ? 0 : Math.max(0, held - total),
    paymentState,
  };
}

/** The recorded facts of a sale, without any derived or storage-only fields. */
export function toInput(sale: Sale | DerivedSale): SaleInput {
  const {
    id: _id, number: _number, subtotal: _s, total: _t, cost: _c, profit: _p,
    paidGross: _pg, refunded: _r, returned: _rt, paid: _pd, balance: _b, refundDue: _rd,
    credit: _cr, paymentState: _ps, ...input
  } = sale as Sale;
  return input;
}

/** Re-derive a stored sale so stale or legacy derived fields never leak into the UI or reports. */
export function normalizeSale(sale: Sale): Sale {
  return { ...(derive(sale) as DerivedSale), id: sale.id, number: sale.number } as Sale;
}

export interface LedgerIssue {
  code:
    | "invalid-amount"
    | "invalid-kind"
    | "invalid-reason"
    | "invalid-method"
    | "invalid-date"
    | "refund-exceeds-paid"
    | "refund-before-payment"
    | "overpaid";
  message: string;
}
export class LedgerError extends Error {
  issues: LedgerIssue[];
  constructor(issues: LedgerIssue[]) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "LedgerError";
    this.issues = issues;
  }
}

/**
 * Validate a sale's payment ledger. Array order is the order of events: the
 * running net (payments - refunds) may never go below zero, so a refund can
 * never exceed what is currently held. Active sales cannot be paid beyond
 * their total (refunds do not re-open room to overpay).
 */
export function validatePayments(
  payments: Payment[],
  opts: { total: number; cancelled: boolean },
): LedgerIssue[] {
  const issues: LedgerIssue[] = [];
  const add = (code: LedgerIssue["code"], message: string) => issues.push({ code, message });
  let net = 0;
  let held = 0;
  let firstPayment = Infinity;
  for (const p of payments) {
    if (!Number.isInteger(p.amount) || p.amount <= 0) {
      add("invalid-amount", "Jumlah harus bilangan bulat lebih dari nol.");
      continue;
    }
    if (p.kind !== undefined && p.kind !== "payment" && p.kind !== "refund") {
      add("invalid-kind", "Jenis catatan pembayaran tidak dikenal.");
      continue;
    }
    if (p.reason !== undefined && p.reason !== "return" && p.reason !== "cancellation") {
      add("invalid-reason", "Alasan pengembalian dana tidak dikenal.");
      continue;
    }
    if (!isRefund(p) && p.reason !== undefined) {
      add("invalid-reason", "Alasan hanya berlaku untuk pengembalian dana.");
      continue;
    }
    if (!(paymentMethods as readonly string[]).includes(p.method))
      add("invalid-method", "Metode pembayaran tidak dikenal.");
    const time = new Date(p.date).getTime();
    if (!Number.isFinite(time)) add("invalid-date", "Tanggal pembayaran tidak valid.");
    if (isRefund(p)) {
      if (Number.isFinite(time) && time < firstPayment)
        add("refund-before-payment", "Tanggal pengembalian dana tidak boleh sebelum pembayaran pertama.");
      net -= p.amount;
      if (isCancellationRefund(p)) held -= p.amount;
      if (net < 0) {
        add("refund-exceeds-paid", "Pengembalian dana melebihi jumlah yang sudah dibayar.");
        net = 0;
      }
    } else {
      net += p.amount;
      held += p.amount;
      if (Number.isFinite(time) && time < firstPayment) firstPayment = time;
    }
  }
  if (!opts.cancelled && held > opts.total)
    add("overpaid", "Pembayaran melebihi total penjualan.");
  return issues;
}

/** Throws a `LedgerError` listing every problem; used by storage before any write. */
export function assertValidSale(input: SaleInput) {
  const d = derive(input);
  const issues = validatePayments(input.payments, {
    total: d.total,
    cancelled: input.fulfillment.status === "cancelled",
  });
  if (issues.length) throw new LedgerError(issues);
}

export function saleNumber(date: string, sequence: number) {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `INV-${yy}${mm}-${String(sequence).padStart(3, "0")}`;
}

export function isAllDigital(items: SaleItem[]) {
  return items.length > 0 && items.every((i) => i.kind === "digital");
}

export function nextFulfillment(
  status: FulfillmentStatus,
  digital: boolean,
): FulfillmentStatus | null {
  if (status === "cancelled" || status === "done") return null;
  if (digital) return status === "confirmed" ? "delivered" : "done";
  return (
    { confirmed: "packed", packed: "shipped", shipped: "done", delivered: "done" } as const
  )[status];
}

export const fulfillmentLabels: Record<FulfillmentStatus, string> = {
  confirmed: "Dikonfirmasi",
  packed: "Dikemas",
  shipped: "Dikirim",
  delivered: "Terkirim (digital)",
  done: "Selesai",
  cancelled: "Dibatalkan",
};
export const paymentLabels: Record<PaymentState, string> = {
  unpaid: "Belum bayar",
  partial: "DP / sebagian",
  paid: "Lunas",
};

/** Net stock change per product for a sale (negative = stock leaves). */
export function saleStockDeltas(
  items: SaleItem[],
  direction: 1 | -1 = -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    deltas.set(
      item.productId,
      (deltas.get(item.productId) ?? 0) + direction * item.quantity,
    );
  }
  return deltas;
}

export function purchaseStockDeltas(items: Purchase["items"]) {
  const deltas = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    deltas.set(
      item.productId,
      (deltas.get(item.productId) ?? 0) + Math.max(0, item.quantity),
    );
  }
  return deltas;
}

function buildPayment(
  kind: "payment" | "refund",
  amount: number,
  method: Payment["method"],
  date: string,
  note: string,
  reason?: "return" | "cancellation",
): Payment {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new RangeError("Jumlah harus bilangan bulat lebih dari nol.");
  if (!Number.isFinite(new Date(date).getTime()))
    throw new RangeError("Tanggal tidak valid.");
  return {
    id: `${kind === "refund" ? "ref" : "pay"}-${Math.random().toString(36).slice(2, 10)}`,
    amount,
    ...(kind === "refund" ? { kind, reason: reason ?? "return" } : {}),
    method,
    date,
    note,
  };
}
/** A payment record. Throws unless `amount` is a positive whole number. */
export const newPayment = (amount: number, method: Payment["method"], date: string, note = "") =>
  buildPayment("payment", amount, method, date, note);
/** A refund record (positive amount; `kind: "refund"` carries the direction). */
export const newRefund = (
  amount: number,
  method: Payment["method"],
  date: string,
  note = "",
  reason: "return" | "cancellation" = "return",
) => buildPayment("refund", amount, method, date, note, reason);

/**
 * Append a payment or refund to a sale and return the new recorded facts, or
 * throw a `LedgerError` if the ledger would become invalid (e.g. a refund
 * larger than the net amount paid, or overpaying an active sale).
 */
export function applyPayment(
  sale: Sale | SaleInput,
  entry: { kind: "payment" | "refund"; amount: number; method: Payment["method"]; date: string; note?: string; reason?: "return" | "cancellation" },
): SaleInput {
  const input = toInput(sale as Sale);
  // The reason follows the sale's state at the time, so callers cannot misfile it.
  const reason = entry.reason ?? (input.fulfillment.status === "cancelled" ? "cancellation" : "return");
  const record = buildPayment(entry.kind, entry.amount, entry.method, entry.date, entry.note ?? "", reason);
  const next = { ...input, payments: [...input.payments, record] };
  assertValidSale(next);
  return next;
}

/** Convert one legacy transaction doc to the new model. Pure and deterministic. */
export function migrateLegacy(
  t: Transaction,
):
  | { kind: "sale"; id: string; sale: Omit<Sale, "id" | "number"> }
  | { kind: "purchase"; id: string; purchase: Purchase }
  | null {
  const date = t.date || new Date().toISOString();
  if (t.type === "stock") {
    const quantity = Math.max(1, t.quantity ?? 1);
    const unitCost = money(t.basePrice);
    return {
      kind: "purchase",
      id: t.id,
      purchase: {
        id: t.id,
        date,
        supplier: "",
        items: [{ name: t.productName || "Stok", quantity, unitCost }],
        shipping: 0,
        total: quantity * unitCost,
        notes: t.notes || "",
        legacyId: t.id,
      },
    };
  }
  if (t.type !== "sale") return null;
  const items: SaleItem[] =
    t.items && t.items.length
      ? t.items.map((i) => ({
          name: i.productName,
          option: "",
          kind: "physical",
          quantity: i.quantity,
          unitPrice: i.sellingPrice,
          unitCost: i.basePrice,
        }))
      : [
          {
            name: t.productName || "Penjualan",
            option: "",
            kind: "physical",
            quantity: 1,
            unitPrice: t.totalSellingPrice ?? t.sellingPrice ?? 0,
            unitCost: t.totalBasePrice ?? t.basePrice ?? 0,
          },
        ];
  const payments: Payment[] = [];
  const legacyTotal = t.totalSellingPrice ?? t.sellingPrice ?? 0;
  const base = derive({
    date,
    channel: "manual",
    customer: { name: t.buyerName || "", whatsapp: "", address: "" },
    items,
    shipping: 0,
    discount: 0,
    fees: 0,
    payments: [],
    fulfillment: {
      status: "done",
      courier: "",
      trackingNo: "",
      deliveryNote: "",
      updatedAt: date,
    },
    notes: t.notes || "",
    legacyId: t.id,
  });
  // Keep the originally recorded total even if line items disagree.
  const total = base.total || money(legacyTotal);
  if (t.paymentStatus === "Paid" && total > 0)
    payments.push({
      id: `legacy-${t.id}`,
      amount: total,
      method: t.paymentMethod === "Cash" || t.paymentMethod === "Transfer" ? t.paymentMethod : "QRIS",
      date,
      note: "Dimigrasi dari catatan lama",
    });
  return {
    kind: "sale",
    id: t.id,
    sale: derive({ ...base, payments }),
  };
}

/** Purchase amounts recomputed from the recorded lines, never from the stored `total`. */
export function purchaseTotals(p: Purchase) {
  const goods = p.items.reduce(
    (s, i) => s + money(i.quantity) * money(i.unitCost),
    0,
  );
  const shipping = money(p.shipping);
  return { goods, shipping, total: goods + shipping };
}

export function customerStats(customer: Customer, sales: Sale[]) {
  const mine = sales
    .map(normalizeSale)
    .filter(
      (s) =>
        s.fulfillment.status !== "cancelled" &&
        (s.customerId
          ? s.customerId === customer.id
          : s.customer.name.trim().toLowerCase() ===
            customer.name.trim().toLowerCase()),
    );
  return {
    orders: mine.length,
    spent: mine.reduce((s, x) => s + x.total - x.refunded, 0),
    debt: mine.reduce((s, x) => s + x.balance, 0),
    sales: mine,
  };
}

/** Digits only, 8-15 long; anything else is not a usable wa.me number. */
export function waNumber(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

export function whatsAppUpdateLink(
  sale: Sale,
  businessName?: string,
): string | null {
  const phone = waNumber(sale.customer.whatsapp);
  if (!phone) return null;
  const lines = [
    `Halo ${sale.customer.name}, update pesanan ${sale.number}${businessName ? ` dari ${businessName}` : ""}:`,
    `Status: ${fulfillmentLabels[sale.fulfillment.status]}`,
  ];
  if (sale.fulfillment.trackingNo)
    lines.push(
      `Kurir: ${sale.fulfillment.courier || "-"} · Resi: ${sale.fulfillment.trackingNo}`,
    );
  if (sale.fulfillment.deliveryNote)
    lines.push(`\n${sale.fulfillment.deliveryNote}`);
  lines.push(
    sale.balance > 0
      ? `\nTotal ${formatRupiah(sale.total)}, sudah dibayar ${formatRupiah(sale.paid)}. Sisa tagihan ${formatRupiah(sale.balance)}.`
      : `\nTotal ${formatRupiah(sale.total)} sudah lunas. Terima kasih!`,
  );
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

