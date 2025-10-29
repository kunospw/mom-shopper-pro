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
import { Plus, List, BarChart3, User, LogOut, Settings, Building, DollarSign, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    setTransactions(getTransactions());
  }, []);

  const handleAddTransaction = (transaction: Transaction) => {
    addTransaction(transaction);
    setTransactions(getTransactions());
    setActiveTab("list");
  };

  const handleUpdateTransaction = (transaction: Transaction) => {
    updateTransaction(transaction.id, transaction);
    setTransactions(getTransactions());
    setEditingTransaction(null);
    setActiveTab("list");
  };

  const handleDeleteTransaction = (id: string) => {
    deleteTransaction(id);
    setTransactions(getTransactions());
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

  const handleStatusChange = (id: string, newStatus: 'Paid' | 'Pending') => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      const updatedTransaction = { ...transaction, paymentStatus: newStatus };
      updateTransaction(id, updatedTransaction);
      setTransactions(getTransactions());
      
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
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-4 pb-20">
        {/* Enhanced Header */}
        <div className="bg-card/50 backdrop-blur rounded-2xl shadow-lg p-6 mb-8 border-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-primary">
                    {user?.businessName || "Mom Shopper Pro"}
                  </h1>
                  <p className="text-muted-foreground">Kelola transaksi reseller dengan mudah</p>
                </div>
              </div>
            </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.photoURL} />
                  <AvatarFallback>
                    {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Keluar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Transaksi Lunas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.paymentStatus === 'Paid').length}
              </div>
              <p className="text-xs text-muted-foreground">Sudah dibayar</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                Belum Lunas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.paymentStatus === 'Pending').length}
              </div>
              <p className="text-xs text-muted-foreground">Menunggu pembayaran</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Pemasukan Lunas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
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
              <p className="text-xs text-muted-foreground">Dari transaksi lunas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Total Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
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
              <p className="text-xs text-muted-foreground">Keuntungan bersih</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="add" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Semua</span>
            </TabsTrigger>
            <TabsTrigger value="lunas" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Lunas</span>
            </TabsTrigger>
            <TabsTrigger value="belum-lunas" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Belum Lunas</span>
            </TabsTrigger>
            <TabsTrigger value="recap" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Rekap</span>
            </TabsTrigger>
          </TabsList>

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
            <div className="mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Transaksi Lunas ({transactions.filter(t => t.paymentStatus === 'Paid').length})
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Total pemasukan: {formatRupiah(
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
            <div className="mb-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-medium text-orange-800 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Transaksi Belum Lunas ({transactions.filter(t => t.paymentStatus === 'Pending').length})
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  Potensi pemasukan: {formatRupiah(
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
      </div>

      <InvoiceModal
        transaction={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
    </div>
  );
};

export default Index;
