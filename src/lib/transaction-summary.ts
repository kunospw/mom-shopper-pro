import type { Transaction } from "@/types/transaction";

export function summarizeTransactions(transactions: Transaction[]) {
  const sales = transactions.filter(t => t.type === "sale");
  const value = (t: Transaction) => t.totalSellingPrice ?? t.sellingPrice ?? 0;
  return {
    sales: sales.reduce((sum, t) => sum + value(t), 0),
    paid: sales.filter(t => t.paymentStatus === "Paid").reduce((sum, t) => sum + value(t), 0),
    pending: sales.filter(t => t.paymentStatus === "Pending").reduce((sum, t) => sum + value(t), 0),
    purchases: transactions.filter(t => t.type === "stock").reduce((sum, t) => sum + (t.basePrice ?? 0) * (t.quantity ?? 1), 0),
  };
}
