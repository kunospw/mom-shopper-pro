import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type { Transaction } from "@/types/transaction";
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/storage";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { InvoiceModal } from "@/components/InvoiceModal";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { formatRupiah } from "@/lib/currency";
import {
  Plus,
  ArrowRight,
  CheckCircle,
  Clock,
  TrendingUp,
  ShoppingCart,
  X,
} from "lucide-react";
import { transactionFilters } from "@/lib/navigation";
import { summarizeTransactions } from "@/lib/transaction-summary";
import { toast } from "sonner";

const Index = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(
    null,
  );
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const editId = params.get("edit");
  const newType = params.get("new");
  const editorOpen =
    pathname === "/transactions" &&
    (!!editId || newType === "sale" || newType === "stock");
  const editingTransaction = editId
    ? transactions.find((t) => t.id === editId)
    : null;
  const blocker = useUnsavedChanges(editorOpen && (formDirty || saving));
  const summary = summarizeTransactions(transactions);
  const filters = transactionFilters(params);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    getTransactions()
      .then((records) => {
        if (active) setTransactions(records);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.uid, retry]);
  useEffect(() => {
    if (!editorOpen) setFormDirty(false);
  }, [editorOpen]);

  function closeEditor() {
    if (saving) return;
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("edit");
    setParams(next);
  }
  async function saveTransaction(transaction: Transaction) {
    setSaving(true);
    try {
      if (editId) await updateTransaction(transaction.id, transaction);
      else await addTransaction(transaction);
      setTransactions((previous) =>
        editId
          ? previous.map((t) => (t.id === transaction.id ? transaction : t))
          : [transaction, ...previous],
      );
      // The successful write is the point at which leaving the form becomes safe.
      flushSync(() => {
        setFormDirty(false);
        setSaving(false);
      });
      const next = new URLSearchParams(params);
      next.delete("new");
      next.delete("edit");
      setParams(next, { replace: true });
    } catch (error) {
      setSaving(false);
      throw error;
    }
  }
  async function removeTransaction(id: string) {
    await deleteTransaction(id);
    setTransactions((previous) => previous.filter((t) => t.id !== id));
  }
  async function changeStatus(id: string, paymentStatus: "Paid" | "Pending") {
    const transaction = transactions.find((t) => t.id === id);
    if (!transaction) return;
    try {
      await updateTransaction(id, { ...transaction, paymentStatus });
      setTransactions((previous) =>
        previous.map((t) => (t.id === id ? { ...t, paymentStatus } : t)),
      );
      toast.success(
        paymentStatus === "Paid"
          ? "Pembayaran ditandai lunas"
          : "Pembayaran ditandai belum lunas",
      );
    } catch {
      toast.error("Status belum berubah. Silakan coba lagi.");
    }
  }
  function edit(transaction: Transaction) {
    const next = new URLSearchParams(params);
    next.set("edit", transaction.id);
    next.delete("new");
    navigate(`/transactions?${next}`);
  }
  const listActions = {
    onEdit: edit,
    onDelete: removeTransaction,
    onViewInvoice: setSelectedInvoice,
    onStatusChange: changeStatus,
    showStatusButtons: true,
  };
  const isOverview = pathname === "/";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isOverview
              ? "Ringkasan"
              : pathname === "/reports"
                ? "Laporan"
                : "Transaksi"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOverview
              ? "Lihat kondisi usaha dan tentukan langkah berikutnya."
              : pathname === "/reports"
                ? "Tinjau penjualan, modal, dan keuntungan menurut periode."
                : "Cari catatan penjualan, pembelian stok, dan pembayaran pelanggan."}
          </p>
        </div>
        {pathname === "/transactions" && (
          <Button asChild>
            <Link to="/transactions?new=sale">
              <Plus />
              Tambah transaksi
            </Link>
          </Button>
        )}
      </header>
      {loading ? (
        <div role="status" aria-label="Memuat transaksi" className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-44" />
          <p className="text-sm text-muted-foreground">Memuat catatan usaha…</p>
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p role="alert">Catatan belum dapat dimuat.</p>
            <Button
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {isOverview && (
            <>
              <section
                aria-label="Ringkasan seluruh transaksi"
                className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4"
              >
                {[
                  {
                    label: "Penjualan tercatat",
                    value: summary.sales,
                    description: "Termasuk yang belum dibayar",
                    icon: TrendingUp,
                    path: "/transactions?type=sale",
                  },
                  {
                    label: "Pembayaran diterima",
                    value: summary.paid,
                    description: "Penjualan berstatus lunas",
                    icon: CheckCircle,
                    path: "/transactions?status=Paid",
                  },
                  {
                    label: "Belum dibayar",
                    value: summary.pending,
                    description: "Lihat pembayaran tertunda",
                    icon: Clock,
                    path: "/transactions?status=Pending",
                  },
                  {
                    label: "Pembelian stok",
                    value: summary.purchases,
                    description: "Biaya pembelian tercatat",
                    icon: ShoppingCart,
                    path: "/transactions?type=stock",
                  },
                ].map((metric) => (
                  <Link
                    key={metric.label}
                    to={metric.path}
                    className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Card className="h-full transition-colors hover:border-primary/40">
                      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {metric.label}
                        </CardTitle>
                        <metric.icon className="h-4 w-4 shrink-0 text-primary" />
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="break-words text-xl font-semibold sm:text-2xl">
                          {formatRupiah(metric.value)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {metric.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </section>
              <p className="text-xs text-muted-foreground">
                Seluruh periode · Status pembayaran diperbarui secara manual.
              </p>
              <section
                aria-labelledby="quick-actions-title"
                className="space-y-3"
              >
                <h2 id="quick-actions-title" className="text-lg font-semibold">
                  Apa yang ingin Anda catat?
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      path: "/transactions?new=sale",
                      label: "Catat penjualan",
                      description:
                        "Produk yang terjual dan pembayaran pelanggan",
                      icon: Plus,
                    },
                    {
                      path: "/transactions?new=stock",
                      label: "Catat pembelian stok",
                      description: "Barang yang dibeli dan biaya modalnya",
                      icon: ShoppingCart,
                    },
                  ].map((action) => (
                    <Button
                      key={action.path}
                      asChild
                      variant="outline"
                      className="h-auto justify-start whitespace-normal p-4"
                    >
                      <Link to={action.path}>
                        <action.icon className="mr-2 shrink-0" />
                        <span className="min-w-0 text-left">
                          <span className="block font-medium">
                            {action.label}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {action.description}
                          </span>
                        </span>
                        <ArrowRight className="ml-auto shrink-0" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </section>
              <section className="space-y-3" aria-labelledby="pending-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="pending-title" className="text-lg font-semibold">
                    Pembayaran yang perlu ditindaklanjuti
                  </h2>
                  <Button asChild variant="ghost">
                    <Link to="/transactions?status=Pending">
                      Lihat semua
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                {transactions.some(
                  (t) => t.type === "sale" && t.paymentStatus === "Pending",
                ) ? (
                  <TransactionList
                    transactions={transactions
                      .filter(
                        (t) =>
                          t.type === "sale" && t.paymentStatus === "Pending",
                      )
                      .slice(0, 3)}
                    {...listActions}
                    showFilters={false}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      Tidak ada penjualan yang menunggu pembayaran.
                    </CardContent>
                  </Card>
                )}
              </section>
            </>
          )}
          {pathname === "/transactions" && (
            <TransactionList
              transactions={transactions}
              {...listActions}
              statusFilter={filters.status}
              typeFilter={filters.type}
              monthFilter={filters.month}
              searchText={filters.q}
              onFilterChange={(key, value) => {
                const next = new URLSearchParams(params);
                if (key === "reset") {
                  for (const field of ["status", "type", "month", "q"])
                    next.delete(field);
                } else if (value && value !== "all") next.set(key, value);
                else next.delete(key);
                setParams(next, { replace: true });
              }}
            />
          )}
          {pathname === "/reports" && (
            <MonthlyRecap transactions={transactions} />
          )}
        </>
      )}
      <Dialog
        open={editorOpen && !loading}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 sm:p-6 [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle>
                {editId
                  ? "Edit transaksi"
                  : newType === "stock"
                    ? "Catat pembelian stok"
                    : "Catat penjualan"}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                disabled={saving}
                aria-label="Tutup formulir"
                onClick={closeEditor}
              >
                <X />
              </Button>
            </div>
            <DialogDescription>
              Isi detail, lalu simpan. Catatan baru tersimpan setelah proses
              selesai.
            </DialogDescription>
          </DialogHeader>
          {editId && !editingTransaction ? (
            <div className="space-y-3">
              <p>Transaksi tidak ditemukan.</p>
              <Button variant="outline" onClick={closeEditor}>
                Kembali ke transaksi
              </Button>
            </div>
          ) : (
            <TransactionForm
              key={editId || newType}
              defaultType={newType === "stock" ? "stock" : "sale"}
              editingTransaction={editingTransaction}
              onSubmit={saveTransaction}
              onCancel={closeEditor}
              onDirtyChange={setFormDirty}
            />
          )}
        </DialogContent>
      </Dialog>
      <InvoiceModal
        transaction={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
};
export default Index;
