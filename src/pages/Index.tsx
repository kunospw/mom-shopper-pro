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
import { Plus, List, BarChart3, User, LogOut, Settings, Building, DollarSign, CheckCircle, Clock, TrendingUp, ShoppingCart } from "lucide-react";
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
          toast.success('✅ Transaksi berhasil diubah ke Lunas!', {
            description: `Pembayaran dari ${transaction.buyerName || 'Customer'} telah dikonfirmasi`
          });
        } else {
          toast.warning('⏰ Transaksi berhasil diubah ke Belum Lunas', {
            description: `Status pembayaran dari ${transaction.buyerName || 'Customer'} diubah ke pending`
          });
        }
      } catch (error) {
        console.error("Error updating transaction status:", error);
        toast.error("Gagal mengubah status pembayaran. Coba lagi.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Sticky Top Navbar - Compact on Mobile */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-lg border-b-2 border-gray-300">
        <div className="max-w-4xl mx-auto px-3 py-2 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Building className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-3xl font-bold text-gray-800 truncate">
                  {user?.businessName || "Reseller Manager App"}
                </h1>
                <p className="text-xs sm:text-base text-gray-600 font-semibold hidden sm:block">📋 Kelola Bisnis Reseller Anda</p>
              </div>
            </div>
          
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Button 
                asChild 
                variant="outline" 
                className="hidden sm:flex items-center gap-2 px-4 py-2 h-11 text-sm border-2 border-gray-300 hover:bg-gray-100 font-semibold"
              >
                <Link to="/profile">
                  <User className="h-4 w-4" />
                  <span className="font-semibold">Pengaturan</span>
                </Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 flex-shrink-0">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                      <AvatarImage src={user?.photoURL} />
                      <AvatarFallback className="text-base sm:text-lg font-bold">
                        {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <div className="flex items-center justify-start gap-3 p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.photoURL} />
                      <AvatarFallback className="text-sm font-semibold">
                        {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-semibold text-sm">{user?.displayName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center py-3 px-4 text-sm font-medium">
                      <User className="mr-3 h-5 w-5" />
                      <span>Pengaturan Profil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="py-3 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50">
                    <LogOut className="mr-3 h-5 w-5" />
                    <span>Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-20 space-y-4 sm:space-y-6">
        {/* Tabs Section - Scrollable on Mobile */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <TabsList className="inline-flex w-full sm:grid sm:grid-cols-5 mb-4 sm:mb-8 h-12 sm:h-14 border-2 border-gray-300 bg-gray-50 min-w-max sm:min-w-0">
              <TabsTrigger value="add" className="gap-1 sm:gap-2 text-sm sm:text-base font-bold px-3 sm:px-4 py-2 sm:py-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0">
                <Plus className="h-4 w-4 sm:h-6 sm:w-6" />
                <span>Tambah</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1 sm:gap-2 text-sm sm:text-base font-bold px-3 sm:px-4 py-2 sm:py-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0">
                <List className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="hidden sm:inline">Semua Transaksi</span>
                <span className="sm:hidden">Semua</span>
              </TabsTrigger>
              <TabsTrigger value="lunas" className="gap-1 sm:gap-2 text-sm sm:text-base font-bold px-3 sm:px-4 py-2 sm:py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0">
                <CheckCircle className="h-4 w-4 sm:h-6 sm:w-6" />
                <span>Lunas</span>
              </TabsTrigger>
              <TabsTrigger value="belum-lunas" className="gap-1 sm:gap-2 text-sm sm:text-base font-bold px-3 sm:px-4 py-2 sm:py-3 data-[state=active]:bg-orange-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-6 sm:w-6" />
                <span>Pending</span>
              </TabsTrigger>
              <TabsTrigger value="recap" className="gap-1 sm:gap-2 text-sm sm:text-base font-bold px-3 sm:px-4 py-2 sm:py-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0">
                <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6" />
                <span>Laporan</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="add">
            <TransactionForm
              onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
              editingTransaction={editingTransaction}
              onCancel={handleCancelEdit}
            />
          </TabsContent>

          <TabsContent value="list">
            <TransactionList
              transactions={transactions}
              onEdit={handleEditClick}
              onDelete={handleDeleteTransaction}
              onViewInvoice={handleViewInvoice}
            />
          </TabsContent>

          <TabsContent value="lunas">
            <div className="mb-4 sm:mb-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-green-800 flex items-center gap-2 sm:gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  Transaksi Yang Sudah Dibayar ({transactions.filter(t => t.paymentStatus === 'Paid').length})
                </h3>
                <p className="text-sm sm:text-base text-green-700 font-medium">
                  Total uang yang sudah masuk: {formatRupiah(
                    transactions
                      .filter(t => t.paymentStatus === 'Paid')
                      .reduce((sum, t) => {
                        if (t.type === 'sale') {
                          return sum + (t.totalSellingPrice || t.sellingPrice || 0);
                        }
                        return sum + (t.sellingPrice || 0);
                      }, 0)
                  )}
                </p>
              </div>
            </div>
            <TransactionList
              transactions={transactions.filter(t => t.paymentStatus === 'Paid')}
              onEdit={handleEditClick}
              onDelete={handleDeleteTransaction}
              onViewInvoice={handleViewInvoice}
              onStatusChange={handleStatusChange}
              showStatusButtons={true}
            />
          </TabsContent>

          <TabsContent value="belum-lunas">
            <div className="mb-4 sm:mb-6">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-orange-800 flex items-center gap-2 sm:gap-3 mb-2">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  Transaksi Menunggu Pembayaran ({transactions.filter(t => t.paymentStatus === 'Pending').length})
                </h3>
                <p className="text-sm sm:text-base text-orange-700 font-medium">
                  Uang yang akan masuk: {formatRupiah(
                    transactions
                      .filter(t => t.paymentStatus === 'Pending')
                      .reduce((sum, t) => {
                        if (t.type === 'sale') {
                          return sum + (t.totalSellingPrice || t.sellingPrice || 0);
                        }
                        return sum + (t.sellingPrice || 0);
                      }, 0)
                  )}
                </p>
              </div>
            </div>
            <TransactionList
              transactions={transactions.filter(t => t.paymentStatus === 'Pending')}
              onEdit={handleEditClick}
              onDelete={handleDeleteTransaction}
              onViewInvoice={handleViewInvoice}
              onStatusChange={handleStatusChange}
              showStatusButtons={true}
            />
          </TabsContent>

          <TabsContent value="recap">
            <MonthlyRecap transactions={transactions} />
          </TabsContent>
        </Tabs>

        {/* Dashboard Stats - Compact on Mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-4">
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-3">
                <CheckCircle className="h-4 w-4 sm:h-7 sm:w-7 text-green-600" />
                <span className="hidden sm:inline">Sudah Dibayar</span>
                <span className="sm:hidden">Lunas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1 sm:mb-3">
                {transactions.filter(t => t.paymentStatus === 'Paid').length}
              </div>
              <p className="text-xs sm:text-base text-gray-700 font-semibold">Transaksi Selesai</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-2 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-3">
                <Clock className="h-4 w-4 sm:h-7 sm:w-7 text-orange-600" />
                <span className="hidden sm:inline">Menunggu Bayar</span>
                <span className="sm:hidden">Pending</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-4xl font-bold text-orange-600 mb-1 sm:mb-3">
                {transactions.filter(t => t.paymentStatus === 'Pending').length}
              </div>
              <p className="text-xs sm:text-base text-gray-700 font-semibold">Belum Dibayar</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-3">
                <TrendingUp className="h-4 w-4 sm:h-7 sm:w-7 text-blue-600" />
                <span className="hidden sm:inline">Uang Masuk</span>
                <span className="sm:hidden">Masuk</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-blue-600 mb-1 sm:mb-3">
                {formatRupiah(
                  transactions
                    .filter(t => t.paymentStatus === 'Paid')
                    .reduce((sum, t) => {
                      if (t.type === 'sale') {
                        return sum + (t.totalSellingPrice || t.sellingPrice || 0);
                      }
                      return sum + (t.sellingPrice || 0);
                    }, 0)
                )}
              </div>
              <p className="text-xs sm:text-base text-gray-700 font-semibold">Yang Sudah Diterima</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-3">
                <DollarSign className="h-4 w-4 sm:h-7 sm:w-7 text-emerald-600" />
                <span className="hidden sm:inline">Keuntungan</span>
                <span className="sm:hidden">Untung</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-emerald-600 mb-1 sm:mb-3">
                {formatRupiah(
                  transactions
                    .filter(t => t.paymentStatus === 'Paid')
                    .reduce((sum, t) => {
                      if (t.type === 'sale') {
                        return sum + (t.totalProfit || t.profit || 0);
                      }
                      return sum + (t.profit || 0);
                    }, 0)
                )}
              </div>
              <p className="text-xs sm:text-base text-gray-700 font-semibold">Profit Bersih</p>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow col-span-2 md:col-span-1">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-3">
                <ShoppingCart className="h-4 w-4 sm:h-7 sm:w-7 text-purple-600" />
                <span className="hidden sm:inline">Uang Keluar</span>
                <span className="sm:hidden">Keluar</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-purple-600 mb-1 sm:mb-3">
                {formatRupiah(
                  transactions
                    .filter(t => t.type === 'stock')
                    .reduce((sum, t) => {
                      return sum + ((t.basePrice || 0) * (t.quantity || 1));
                    }, 0)
                )}
              </div>
              <p className="text-xs sm:text-base text-gray-700 font-semibold">Beli Stok Barang</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceModal
        transaction={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
};

export default Index;
