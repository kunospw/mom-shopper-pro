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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger aria-label="Filter bulan" className="h-11 bg-card">
            <SelectValue placeholder="Semua Bulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bulan</SelectItem>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month} className="text-base">
                {new Date(month + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger aria-label="Filter jenis transaksi" className="h-11 bg-card">
            <SelectValue placeholder="Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">Semua</SelectItem>
            <SelectItem value="sale" className="text-base">Penjualan</SelectItem>
            <SelectItem value="stock" className="text-base">Stok</SelectItem>
          </SelectContent>
        </Select>

        <div className="col-span-2 sm:col-span-1">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger aria-label="Filter status pembayaran" className="h-11 bg-card">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-base">Semua Status</SelectItem>
              <SelectItem value="Paid" className="text-base">Lunas</SelectItem>
              <SelectItem value="Pending" className="text-base">Belum Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="font-medium">{transactions.length ? "Tidak ada transaksi yang sesuai filter" : "Belum ada transaksi"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{transactions.length ? "Coba ubah pilihan filter di atas." : "Pilih Tambah transaksi untuk mencatat penjualan atau pembelian stok pertama."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id} className="overflow-hidden border border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {transaction.type === "stock" ? (
                        <Badge variant="secondary" className="gap-1 text-xs px-2 py-1">
                          <Package className="h-4 w-4" />
                          Stok
                        </Badge>
                      ) : (
                        <Badge
                          variant={transaction.paymentStatus === "Paid" ? "default" : "destructive"}
                          className={
                            transaction.paymentStatus === "Paid"
                              ? "bg-success/10 text-success hover:bg-success/15 text-xs px-2 py-1"
                              : "bg-pending/10 text-pending hover:bg-pending/15 text-xs px-2 py-1"
                          }
                        >
                          {transaction.paymentStatus === "Paid" ? "Lunas" : "Belum Lunas"}
                        </Badge>
                      )}
                    </div>

                    {transaction.type === "sale" ? (
                      <>
                        <h3 className="font-semibold text-lg mb-2 text-foreground">
                          {transaction.items && transaction.items.length > 1 
                            ? `${transaction.items.length} Produk` 
                            : transaction.items?.[0]?.productName}
                        </h3>
                        <p className="text-sm text-muted-foreground">{transaction.buyerName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{formatDate(transaction.date)}</p>

                        <div className="space-y-2 mt-3">
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">Harga Jual:</span>
                            <span className="font-semibold text-foreground">{formatRupiah(transaction.totalSellingPrice || 0)}</span>
                          </div>
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">Keuntungan:</span>
                            <span className="font-semibold text-foreground">{formatRupiah(transaction.totalProfit || 0)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg mb-2 text-foreground">{transaction.productName}</h3>
                        <p className="text-sm text-muted-foreground">Jumlah: {transaction.quantity}</p>
                        <p className="text-sm text-muted-foreground mt-1">{formatDate(transaction.date)}</p>
                        <div className="mt-3">
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">Harga Modal:</span>
                            <span className="font-semibold text-foreground">{formatRupiah(transaction.basePrice || 0)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {transaction.type === "sale" && (
                    <Button
                      size="default"
                      variant="outline"
                      className="h-11"
                      onClick={() => onViewInvoice(transaction)}
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      Invoice
                    </Button>
                  )}
                  
                  {/* Payment Status Change Buttons */}
                  {showStatusButtons && onStatusChange && transaction.type === "sale" && (
                    <>
                      {transaction.paymentStatus === 'Pending' && (
                        <Button
                          size="default"
                          variant="outline"
                          className="text-success hover:text-success hover:bg-success/10 border border-success/30 flex-shrink-0 font-semibold h-11"
                          onClick={() => onStatusChange(transaction.id, 'Paid')}
                        >
                          <CheckCircle className="h-5 w-5 mr-2" />
                          <span>Sudah Bayar</span>
                        </Button>
                      )}
                      {transaction.paymentStatus === 'Paid' && (
                        <Button
                          size="default"
                          variant="outline"
                          className="text-pending hover:text-pending hover:bg-pending/10 border border-pending/30 flex-shrink-0 font-semibold h-11"
                          onClick={() => onStatusChange(transaction.id, 'Pending')}
                        >
                          <Clock className="h-5 w-5 mr-2" />
                          <span>Belum Bayar</span>
                        </Button>
                      )}
                    </>
                  )}
                  
                  <Button size="default" variant="outline" aria-label="Edit transaksi" onClick={() => onEdit(transaction)} className="h-11 w-11 border border-border">
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-11 w-11 border border-destructive/30"
                    aria-label="Hapus transaksi" onClick={() => handleDeleteClick(transaction.id)}
                  >
                    <Trash2 className="h-5 w-5" />
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
