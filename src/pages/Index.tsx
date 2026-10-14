import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Transaction } from "@/types/transaction";
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/lib/storage";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { InvoiceModal } from "@/components/InvoiceModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { formatRupiah } from "@/lib/currency";
import { Plus, List, BarChart3, LogOut, Settings, CheckCircle, Clock, TrendingUp, ShoppingCart } from "lucide-react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { summarizeTransactions } from "@/lib/transaction-summary";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const loadedTransactions = await getTransactions();
        setTransactions(loadedTransactions);
      } catch (error) {
        console.error("Error loading transactions:", error);
        toast.error("Gagal memuat transaksi. Coba refresh halaman.");
      }
    };
    loadTransactions();
  }, []);

  const handleAddTransaction = async (transaction: Transaction) => {
    try {
      await addTransaction(transaction);
      const updatedTransactions = await getTransactions();
      setTransactions(updatedTransactions);
      setActiveTab("list");
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Gagal menambah transaksi. Coba lagi.");
    }
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    try {
      await updateTransaction(transaction.id, transaction);
      const updatedTransactions = await getTransactions();
      setTransactions(updatedTransactions);
      setEditingTransaction(null);
      setActiveTab("list");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Gagal mengupdate transaksi. Coba lagi.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      const updatedTransactions = await getTransactions();
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Gagal menghapus transaksi. Coba lagi.");
    }
  };

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setActiveTab("add");
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setActiveTab("list");
  };

  const handleViewInvoice = (transaction: Transaction) => {
    setSelectedInvoice(transaction);
  };

  const handleStatusChange = async (id: string, newStatus: 'Paid' | 'Pending') => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      try {
        const updatedTransaction = { ...transaction, paymentStatus: newStatus };
        await updateTransaction(id, updatedTransaction);
        const updatedTransactions = await getTransactions();
        setTransactions(updatedTransactions);
        
        // Show success toast
        if (newStatus === 'Paid') {
          toast.success('Pembayaran ditandai lunas', {
            description: `Pembayaran dari ${transaction.buyerName || 'Customer'} telah dikonfirmasi`
          });
        } else {
          toast.warning('Pembayaran ditandai belum lunas', {
            description: `Status pembayaran dari ${transaction.buyerName || 'Customer'} diubah ke pending`
          });
        }
      } catch (error) {
        console.error("Error updating transaction status:", error);
        toast.error("Gagal mengubah status pembayaran. Coba lagi.");
      }
    }
  };

  const summary = summarizeTransactions(transactions);
  const navigation = [
    { value: "list", label: "Transaksi", icon: List },
    { value: "add", label: "Tambah", icon: Plus },
    { value: "lunas", label: "Lunas", icon: CheckCircle },
    { value: "belum-lunas", label: "Belum lunas", icon: Clock },
    { value: "recap", label: "Laporan", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BusinessBrand name={user?.businessName} logo={user?.businessLogo} />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/profile"><Settings />Pengaturan bisnis</Link></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Menu akun">
                <Avatar className="h-7 w-7"><AvatarImage src={user?.photoURL} /><AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback></Avatar>
              </Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2"><p className="truncate text-sm font-medium">{user?.displayName}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><Settings className="mr-2 h-4 w-4" />Pengaturan bisnis</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Keluar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-sm text-muted-foreground">Ringkasan seluruh periode</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Transaksi & pembayaran</h1>
            <p className="mt-2 text-sm text-muted-foreground">Catat penjualan, pantau pembayaran, dan kelola pembelian stok.</p>
          </div>
          <Button onClick={() => { setEditingTransaction(null); setActiveTab("add"); }}><Plus />Tambah transaksi</Button>
        </section>
        <section aria-label="Ringkasan seluruh transaksi" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Penjualan tercatat", value: summary.sales, description: "Termasuk yang belum dibayar", icon: TrendingUp },
            { label: "Pembayaran diterima", value: summary.paid, description: "Penjualan berstatus lunas", icon: CheckCircle },
            { label: "Belum dibayar", value: summary.pending, description: "Menunggu konfirmasi pembayaran", icon: Clock },
            { label: "Pembelian stok", value: summary.purchases, description: "Total biaya pembelian tercatat", icon: ShoppingCart },
          ].map(metric => <Card key={metric.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle><metric.icon className="h-4 w-4 shrink-0 text-primary" /></CardHeader>
            <CardContent className="p-4 pt-0"><p className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{formatRupiah(metric.value)}</p><p className="mt-2 text-xs text-muted-foreground">{metric.description}</p></CardContent>
          </Card>)}
        </section>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-6 overflow-x-auto pb-1">
            <TabsList className="h-auto w-max gap-1 bg-muted p-1" aria-label="Navigasi bisnis">
              {navigation.map(item => <TabsTrigger key={item.value} value={item.value} className="min-h-11 gap-2 px-4 data-[state=active]:bg-card data-[state=active]:text-primary"><item.icon className="h-4 w-4" />{item.label}</TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value="add"><TransactionForm onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction} editingTransaction={editingTransaction} onCancel={handleCancelEdit} /></TabsContent>
          <TabsContent value="list"><TransactionList transactions={transactions} onEdit={handleEditClick} onDelete={handleDeleteTransaction} onViewInvoice={handleViewInvoice} /></TabsContent>
          <TabsContent value="lunas"><TransactionList transactions={transactions.filter(t => t.type === "sale" && t.paymentStatus === "Paid")} onEdit={handleEditClick} onDelete={handleDeleteTransaction} onViewInvoice={handleViewInvoice} onStatusChange={handleStatusChange} showStatusButtons /></TabsContent>
          <TabsContent value="belum-lunas"><TransactionList transactions={transactions.filter(t => t.type === "sale" && t.paymentStatus === "Pending")} onEdit={handleEditClick} onDelete={handleDeleteTransaction} onViewInvoice={handleViewInvoice} onStatusChange={handleStatusChange} showStatusButtons /></TabsContent>
          <TabsContent value="recap"><MonthlyRecap transactions={transactions} /></TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">Ringkasan mencakup seluruh periode. Status pembayaran diperbarui secara manual.</p>
      </main>
      <InvoiceModal transaction={selectedInvoice} isOpen={!!selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
};

export default Index;
