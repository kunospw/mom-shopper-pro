import { useState } from "react";
import { Transaction } from "@/types/transaction";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRupiah } from "@/lib/currency";
import { Pencil, Trash2, FileText, Package, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onViewInvoice: (transaction: Transaction) => void;
  onStatusChange?: (id: string, newStatus: 'Paid' | 'Pending') => void;
  showStatusButtons?: boolean;
}

export const TransactionList = ({ 
  transactions, 
  onEdit, 
  onDelete, 
  onViewInvoice, 
  onStatusChange, 
  showStatusButtons = false 
}: TransactionListProps) => {
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getMonthYear = (date: string) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const availableMonths = Array.from(
    new Set(transactions.map((t) => getMonthYear(t.date)))
  ).sort((a, b) => b.localeCompare(a));

  const filteredTransactions = transactions.filter((t) => {
    const monthMatch = filterMonth === "all" || getMonthYear(t.date) === filterMonth;
    const statusMatch = filterStatus === "all" || (t.type === "sale" && t.paymentStatus === filterStatus);
    const typeMatch = filterType === "all" || t.type === filterType;
    return monthMatch && statusMatch && typeMatch;
  });

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger>
            <SelectValue placeholder="Semua Bulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bulan</SelectItem>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {new Date(month + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="sale">Penjualan</SelectItem>
            <SelectItem value="stock">Stok</SelectItem>
          </SelectContent>
        </Select>

        <div className="col-span-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="Paid">Lunas</SelectItem>
              <SelectItem value="Pending">Belum Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada transaksi
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {transaction.type === "stock" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Package className="h-3 w-3" />
                          Stok
                        </Badge>
                      ) : (
                        <Badge
                          variant={transaction.paymentStatus === "Paid" ? "default" : "destructive"}
                          className={
                            transaction.paymentStatus === "Paid"
                              ? "bg-success hover:bg-success/90"
                              : "bg-pending hover:bg-pending/90"
                          }
                        >
                          {transaction.paymentStatus === "Paid" ? "Lunas" : "Belum Lunas"}
                        </Badge>
                      )}
                    </div>

                    {transaction.type === "sale" ? (
                      <>
                        <h3 className="font-semibold text-lg">
                          {transaction.items && transaction.items.length > 1 
                            ? `${transaction.items.length} Produk` 
                            : transaction.items?.[0]?.productName}
                        </h3>
                        <p className="text-sm text-muted-foreground">{transaction.buyerName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(transaction.date)}</p>

                        <div className="space-y-1 mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Harga Jual:</span>
                            <span className="font-medium">{formatRupiah(transaction.totalSellingPrice || 0)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Keuntungan:</span>
                            <span className="font-semibold text-success">{formatRupiah(transaction.totalProfit || 0)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg">{transaction.productName}</h3>
                        <p className="text-sm text-muted-foreground">Jumlah: {transaction.quantity}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(transaction.date)}</p>
                        <div className="mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Harga Modal:</span>
                            <span className="font-medium">{formatRupiah(transaction.basePrice || 0)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {transaction.type === "sale" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onViewInvoice(transaction)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Invoice
                    </Button>
                  )}
                  
                  {/* Payment Status Change Buttons */}
                  {showStatusButtons && onStatusChange && transaction.type === "sale" && (
                    <>
                      {transaction.paymentStatus === 'Pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 flex-shrink-0"
                          onClick={() => onStatusChange(transaction.id, 'Paid')}
                        >
                          <CheckCircle className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Tandai Lunas</span>
                        </Button>
                      )}
                      {transaction.paymentStatus === 'Paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 flex-shrink-0"
                          onClick={() => onStatusChange(transaction.id, 'Pending')}
                        >
                          <Clock className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Tandai Pending</span>
                        </Button>
                      )}
                    </>
                  )}
                  
                  <Button size="sm" variant="outline" onClick={() => onEdit(transaction)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(transaction.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Entry yang dihapus tidak dapat dikembalikan. Apakah Anda yakin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
