export type PaymentMethod = "QRIS" | "Transfer" | "Cash";
export type PaymentStatus = "Paid" | "Pending";

export interface Transaction {
  id: string;
  productName: string;
  basePrice: number;
  sellingPrice: number;
  buyerName: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  date: string;
  profit: number;
}
