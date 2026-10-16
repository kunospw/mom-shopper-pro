export type ItemKind = "physical" | "digital";
export type PaymentMethodV2 = "QRIS" | "Transfer" | "Cash" | "EWallet";
export type PaymentState = "unpaid" | "partial" | "paid";
export type FulfillmentStatus =
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "done"
  | "cancelled";
export type ExpenseCategory =
  | "ongkir"
  | "packaging"
  | "iklan"
  | "admin"
  | "lainnya";

export interface SaleItem {
  productId?: string;
  name: string;
  option: string;
  kind: ItemKind;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}
export type PaymentKind = "payment" | "refund";
export interface Payment {
  id: string;
  /** Always a positive whole Rupiah amount; `kind` carries the direction. */
  amount: number;
  /** Absent on records made before refunds existed: treated as "payment". */
  kind?: PaymentKind;
  /**
   * Refunds only. "return" (default): goods/price returned on an active sale,
   * a reduction of revenue that does not re-open the receivable. "cancellation":
   * money handed back because the sale was cancelled; cash only, and if the
   * sale is re-opened the buyer owes that amount again.
   */
  reason?: "return" | "cancellation";
  method: PaymentMethodV2;
  date: string;
  note: string;
}
export interface Fulfillment {
  status: FulfillmentStatus;
  courier: string;
  trackingNo: string;
  deliveryNote: string;
  updatedAt: string;
}
export interface CustomerSnapshot {
  name: string;
  whatsapp: string;
  address: string;
}
export interface SaleInput {
  date: string;
  channel: "manual" | "catalog";
  orderRequestId?: string;
  customerId?: string;
  customer: CustomerSnapshot;
  items: SaleItem[];
  shipping: number;
  discount: number;
  fees: number;
  payments: Payment[];
  fulfillment: Fulfillment;
  notes: string;
  legacyId?: string;
}
export interface Sale extends SaleInput {
  id: string;
  number: string;
  subtotal: number;
  total: number;
  cost: number;
  profit: number;
  /** Sum of payments, before refunds. */
  paidGross: number;
  /** Sum of all refunds. */
  refunded: number;
  /** Refunds that were sales returns (reduce revenue in the refund month). */
  returned: number;
  /** Net money held for this sale: paidGross - refunded. */
  paid: number;
  /** Still owed by the buyer (0 for cancelled sales). */
  balance: number;
  /** Cancelled sales only: net money still held that should go back. */
  refundDue: number;
  /** Net paid above the total (defensive; validation normally prevents it). */
  credit: number;
  paymentState: PaymentState;
}
export interface PurchaseItem {
  productId?: string;
  name: string;
  quantity: number;
  unitCost: number;
}
export interface Purchase {
  id: string;
  date: string;
  supplier: string;
  items: PurchaseItem[];
  shipping: number;
  total: number;
  notes: string;
  legacyId?: string;
}
export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
}
export interface Customer {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  note: string;
}
export interface Inventory {
  cost: number;
  stock: number | null;
}
