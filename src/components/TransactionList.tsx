import { useState } from "react";
import { Transaction } from "@/types/transaction";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/lib/currency";
import {
  Pencil,
  Trash2,
  FileText,
  Package,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  onDelete: (id: string) => Promise<void> | void;
  onViewInvoice: (transaction: Transaction) => void;
  onStatusChange?: (
    id: string,
    newStatus: "Paid" | "Pending",
  ) => Promise<void> | void;
  showStatusButtons?: boolean;
  showFilters?: boolean;
  statusFilter?: string;
  typeFilter?: string;
  monthFilter?: string;
  searchText?: string;
  onFilterChange?: (
    key: "status" | "type" | "month" | "q" | "reset",
    value: string,
  ) => void;
}

export const TransactionList = ({
  transactions,
  onEdit,
  onDelete,
  onViewInvoice,
  onStatusChange,
  showStatusButtons = false,
  showFilters = true,
  statusFilter,
  typeFilter,
  monthFilter,
  searchText,
  onFilterChange,
}: TransactionListProps) => {
  const [internalMonth, setFilterMonth] = useState<string>("all");
  const [internalStatus, setFilterStatus] = useState<string>("all");
  const [internalType, setFilterType] = useState<string>("all");
  const [internalSearch, setInternalSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  async function updatePayment(id: string, status: "Paid" | "Pending") {
    if (statusBusy) return;
    setStatusBusy(id);
    try {
      await onStatusChange?.(id, status);
    } finally {
      setStatusBusy(null);
    }
  }
  const filterMonth = monthFilter ?? internalMonth;
  const filterStatus = statusFilter ?? internalStatus;
  const filterType = typeFilter ?? internalType;
  const filterSearch = searchText ?? internalSearch;
  const setFilter = (
    key: "status" | "type" | "month" | "q" | "reset",
    value: string,
  ) => {
    if (onFilterChange) onFilterChange(key, value);
    else if (key === "status") setFilterStatus(value);
    else if (key === "type") setFilterType(value);
    else if (key === "month") setFilterMonth(value);
    else if (key === "reset") {
      setFilterStatus("all");
      setFilterType("all");
      setFilterMonth("all");
      setInternalSearch("");
    } else setInternalSearch(value);
  };
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
    new Set(transactions.map((t) => getMonthYear(t.date))),
  ).sort((a, b) => b.localeCompare(a));

  const filteredTransactions = transactions.filter((t) => {
    const monthMatch =
      filterMonth === "all" || getMonthYear(t.date) === filterMonth;
    const statusMatch =
      filterStatus === "all" ||
      (t.type === "sale" && t.paymentStatus === filterStatus);
    const typeMatch = filterType === "all" || t.type === filterType;
    const text = [
      t.buyerName,
      t.productName,
      t.notes,
      ...(t.items?.map((item) => item.productName) || []),
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    const searchMatch = text.includes(
      filterSearch.trim().toLocaleLowerCase("id-ID"),
    );
    return monthMatch && statusMatch && typeMatch && searchMatch;
  });

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
      toast.success("Transaksi dihapus");
    } catch {
      toast.error("Transaksi belum dihapus. Silakan coba lagi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Filter pembayaran">
            {[
              { value: "all", label: "Semua status" },
              { value: "Pending", label: "Belum lunas" },
              { value: "Paid", label: "Lunas" },
            ].map((status) => (
              <Button
                key={status.value}
                type="button"
                variant={filterStatus === status.value ? "secondary" : "ghost"}
                aria-pressed={filterStatus === status.value}
                onClick={() => setFilter("status", status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="transaction-search">Cari transaksi</Label>
              <Input
                id="transaction-search"
                type="search"
                placeholder="Nama pelanggan, produk, atau catatan"
                className="h-11 bg-card"
                value={filterSearch}
                onChange={(event) => setFilter("q", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-type">Jenis</Label>
              <Select
                value={filterType}
                onValueChange={(value) => setFilter("type", value)}
              >
                <SelectTrigger id="transaction-type" className="h-11 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  <SelectItem value="sale">Penjualan</SelectItem>
                  <SelectItem value="stock">Pembelian stok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-month">Periode</Label>
              <Select
                value={filterMonth}
                onValueChange={(value) => setFilter("month", value)}
              >
                <SelectTrigger id="transaction-month" className="h-11 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua bulan</SelectItem>
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
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-xs text-muted-foreground">
              {filteredTransactions.length} transaksi ditampilkan
            </p>
            {(filterStatus !== "all" ||
              filterType !== "all" ||
              filterMonth !== "all" ||
              filterSearch) && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setFilter("reset", "");
                }}
              >
                Hapus filter
              </Button>
            )}
          </div>
        </>
      )}

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="font-medium">
              {transactions.length
                ? "Tidak ada transaksi yang sesuai filter"
                : "Belum ada transaksi"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {transactions.length
                ? "Coba ubah pilihan filter di atas."
                : "Pilih Tambah transaksi untuk mencatat penjualan atau pembelian stok pertama."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <Card
              key={transaction.id}
              className="overflow-hidden border border-border shadow-sm"
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {transaction.type === "stock" ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs px-2 py-1"
                        >
                          <Package className="h-4 w-4" />
                          Stok
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            transaction.paymentStatus === "Paid"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            transaction.paymentStatus === "Paid"
                              ? "bg-success/10 text-success hover:bg-success/15 text-xs px-2 py-1"
                              : "bg-pending/10 text-pending hover:bg-pending/15 text-xs px-2 py-1"
                          }
                        >
                          {transaction.paymentStatus === "Paid"
                            ? "Lunas"
                            : "Belum Lunas"}
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
                        <p className="text-sm text-muted-foreground">
                          {transaction.buyerName}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(transaction.date)}
                        </p>

                        <div className="space-y-2 mt-3">
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">
                              Harga Jual:
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatRupiah(transaction.totalSellingPrice || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">
                              Keuntungan:
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatRupiah(transaction.totalProfit || 0)}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg mb-2 text-foreground">
                          {transaction.productName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Jumlah: {transaction.quantity}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(transaction.date)}
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">
                              Harga Modal:
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatRupiah(transaction.basePrice || 0)}
                            </span>
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
                  {showStatusButtons &&
                    onStatusChange &&
                    transaction.type === "sale" && (
                      <>
                        {transaction.paymentStatus === "Pending" && (
                          <Button
                            size="default"
                            variant="outline"
                            className="text-success hover:text-success hover:bg-success/10 border border-success/30 flex-shrink-0 font-semibold h-11"
                            disabled={!!statusBusy}
                            onClick={() => {
                              void updatePayment(transaction.id, "Paid");
                            }}
                          >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            <span>
                              {statusBusy === transaction.id
                                ? "Memperbarui…"
                                : "Sudah Bayar"}
                            </span>
                          </Button>
                        )}
                        {transaction.paymentStatus === "Paid" && (
                          <Button
                            size="default"
                            variant="outline"
                            className="text-pending hover:text-pending hover:bg-pending/10 border border-pending/30 flex-shrink-0 font-semibold h-11"
                            disabled={!!statusBusy}
                            onClick={() => {
                              void updatePayment(transaction.id, "Pending");
                            }}
                          >
                            <Clock className="h-5 w-5 mr-2" />
                            <span>
                              {statusBusy === transaction.id
                                ? "Memperbarui…"
                                : "Belum Bayar"}
                            </span>
                          </Button>
                        )}
                      </>
                    )}

                  <Button
                    size="default"
                    variant="outline"
                    disabled={statusBusy === transaction.id || deleting}
                    aria-label="Edit transaksi"
                    onClick={() => onEdit(transaction)}
                    className="h-11 w-11 border border-border"
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-11 w-11 border border-destructive/30"
                    disabled={statusBusy === transaction.id || deleting}
                    aria-label="Hapus transaksi"
                    onClick={() => handleDeleteClick(transaction.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi yang dihapus tidak dapat dikembalikan. Apakah Anda
              yakin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
