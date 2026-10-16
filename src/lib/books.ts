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

export function derive(input: SaleInput): Omit<Sale, "id" | "number"> {
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
  const paid = input.payments.reduce((s, p) => s + money(p.amount), 0);
  const balance = Math.max(0, total - paid);
  const paymentState: PaymentState =
    total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
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
    profit: total - cost - fees,
    paid,
    balance,
    paymentState: total === 0 && paid === 0 ? "paid" : paymentState,
  };
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

export function newPayment(
  amount: number,
  method: Payment["method"],
  date: string,
  note = "",
): Payment {
  return {
    id: `pay-${Math.random().toString(36).slice(2, 10)}`,
    amount: money(amount),
    method,
    date,
    note,
  };
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

export interface BookSummary {
  sales: number;
  received: number;
  receivable: number;
  cogs: number;
  purchases: number;
  expenses: number;
  profit: number;
  netProfit: number;
}

const inPeriod = (date: string, month?: string) =>
  !month || month === "all" || date.slice(0, 7) === month;

export function summarizeBooks(
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
  month?: string,
): BookSummary {
  const live = sales.filter((s) => s.fulfillment.status !== "cancelled");
  const periodSales = live.filter((s) => inPeriod(s.date, month));
  const received = live
    .flatMap((s) => s.payments)
    .filter((p) => inPeriod(p.date, month))
    .reduce((s, p) => s + p.amount, 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const profit = sum(periodSales.map((s) => s.profit));
  const expenseTotal = sum(
    expenses.filter((e) => inPeriod(e.date, month)).map((e) => e.amount),
  );
  return {
    sales: sum(periodSales.map((s) => s.total)),
    received,
    receivable: sum(periodSales.map((s) => s.balance)),
    cogs: sum(periodSales.map((s) => s.cost)),
    purchases: sum(
      purchases.filter((p) => inPeriod(p.date, month)).map((p) => p.total),
    ),
    expenses: expenseTotal,
    profit,
    netProfit: profit - expenseTotal,
  };
}

export function customerStats(customer: Customer, sales: Sale[]) {
  const mine = sales.filter(
    (s) =>
      s.fulfillment.status !== "cancelled" &&
      (s.customerId
        ? s.customerId === customer.id
        : s.customer.name.trim().toLowerCase() ===
          customer.name.trim().toLowerCase()),
  );
  return {
    orders: mine.length,
    spent: mine.reduce((s, x) => s + x.total, 0),
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

