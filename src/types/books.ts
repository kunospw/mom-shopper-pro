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
export interface Payment {
  id: string;
  amount: number;
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
  paid: number;
  balance: number;
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
