export type PaymentMethod = "QRIS" | "Transfer" | "Cash";
export type PaymentStatus = "Paid" | "Pending";
export type EntryType = "sale" | "stock";

export interface ProductItem {
  productName: string;
  quantity: number;
  basePrice: number;
  sellingPrice: number;
  profit: number;
}

export interface Transaction {
  id: string;
  type: EntryType;
  // For sales
  items?: ProductItem[];
  buyerName?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  totalBasePrice?: number;
  totalSellingPrice?: number;
  totalProfit?: number;
  // For stock
  productName?: string;
  quantity?: number;
  basePrice?: number;
  // Common fields
  notes: string;
  date: string;
  // Legacy fields for backward compatibility
  sellingPrice?: number;
  profit?: number;
}
