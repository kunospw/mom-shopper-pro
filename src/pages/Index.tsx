import { useState, useEffect } from "react";
import { Transaction } from "@/types/transaction";
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/lib/storage";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { InvoiceModal } from "@/components/InvoiceModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, List, BarChart3 } from "lucide-react";

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">Reseller Manager</h1>
          <p className="text-muted-foreground">Kelola transaksi reseller dengan mudah</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="add" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tambah</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Transaksi</span>
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
  );
};

export default Index;
