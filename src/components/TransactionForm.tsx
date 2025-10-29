import { useState, useEffect } from "react";
import { Transaction, ProductItem, PaymentMethod, PaymentStatus } from "@/types/transaction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/currency";
import { Plus, Trash2 } from "lucide-react";

interface TransactionFormProps {
  onSubmit: (transaction: Transaction) => void;
  editingTransaction?: Transaction | null;
  onCancel?: () => void;
}

export const TransactionForm = ({ onSubmit, editingTransaction, onCancel }: TransactionFormProps) => {
  const [entryType, setEntryType] = useState<"sale" | "stock">("sale");
  
  // Sale fields
  const [items, setItems] = useState<ProductItem[]>([
    { productName: "", quantity: 1, basePrice: 0, sellingPrice: 0, profit: 0 }
  ]);
  const [buyerName, setBuyerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRIS");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Pending");
  
  // Stock fields
  const [stockProductName, setStockProductName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  const [stockBasePrice, setStockBasePrice] = useState("");
  
  // Common fields
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingTransaction) {
      setEntryType(editingTransaction.type);
      if (editingTransaction.type === "sale" && editingTransaction.items) {
        setItems(editingTransaction.items);
        setBuyerName(editingTransaction.buyerName || "");
        setPaymentMethod(editingTransaction.paymentMethod || "QRIS");
        setPaymentStatus(editingTransaction.paymentStatus || "Pending");
      } else if (editingTransaction.type === "stock") {
        setStockProductName(editingTransaction.productName || "");
        setStockQuantity((editingTransaction.quantity || 1).toString());
        setStockBasePrice((editingTransaction.basePrice || 0).toString());
      }
      setNotes(editingTransaction.notes);
    }
  }, [editingTransaction]);

  const addItem = () => {
    setItems([...items, { productName: "", quantity: 1, basePrice: 0, sellingPrice: 0, profit: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ProductItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "basePrice" || field === "sellingPrice" || field === "quantity") {
      const base = parseFloat(newItems[index].basePrice.toString()) || 0;
      const selling = parseFloat(newItems[index].sellingPrice.toString()) || 0;
      const qty = parseFloat(newItems[index].quantity.toString()) || 1;
      newItems[index].profit = (selling - base) * qty;
    }
    
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (entryType === "sale") {
      if (!buyerName || items.some(item => !item.productName || item.basePrice <= 0 || item.sellingPrice <= 0)) {
        toast.error("Mohon lengkapi semua field yang diperlukan");
        return;
      }

      const totalBasePrice = items.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
      const totalSellingPrice = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
      const totalProfit = totalSellingPrice - totalBasePrice;

      const transaction: Transaction = {
        id: editingTransaction?.id || Date.now().toString(),
        type: "sale",
        items,
        buyerName,
        paymentMethod,
        paymentStatus,
        totalBasePrice,
        totalSellingPrice,
        totalProfit,
        notes,
        date: editingTransaction?.date || new Date().toISOString(),
      };

      onSubmit(transaction);
      resetForm();
      toast.success(editingTransaction ? "Transaksi diperbarui" : "Penjualan ditambahkan");
    } else {
      if (!stockProductName || !stockBasePrice || parseFloat(stockBasePrice) <= 0) {
        toast.error("Mohon lengkapi semua field yang diperlukan");
        return;
      }

      const transaction: Transaction = {
        id: editingTransaction?.id || Date.now().toString(),
        type: "stock",
        productName: stockProductName,
        quantity: parseFloat(stockQuantity) || 1,
        basePrice: parseFloat(stockBasePrice),
        notes,
        date: editingTransaction?.date || new Date().toISOString(),
      };

      onSubmit(transaction);
      resetForm();
      toast.success(editingTransaction ? "Stok diperbarui" : "Stok ditambahkan");
    }
  };

  const resetForm = () => {
    setItems([{ productName: "", quantity: 1, basePrice: 0, sellingPrice: 0, profit: 0 }]);
    setBuyerName("");
    setPaymentMethod("QRIS");
    setPaymentStatus("Pending");
    setStockProductName("");
    setStockQuantity("1");
    setStockBasePrice("");
    setNotes("");
  };

  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);

  return (
    <Card className="bg-white/80 backdrop-blur-md border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">{editingTransaction ? "Edit Entry" : "Tambah Entry"}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <Tabs value={entryType} onValueChange={(v) => setEntryType(v as "sale" | "stock")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="sale" disabled={!!editingTransaction} className="text-sm font-medium">
              Penjualan
            </TabsTrigger>
            <TabsTrigger value="stock" disabled={!!editingTransaction} className="text-sm font-medium">
              Stok Barang
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sale">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <Label className="text-sm font-medium">Produk</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItem} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1" />
                    <span className="text-sm">Tambah Produk</span>
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-4 bg-gray-50/50">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <Label className="text-sm font-medium mb-2 block">Nama Produk</Label>
                          <Input
                            value={item.productName}
                            onChange={(e) => updateItem(index, "productName", e.target.value)}
                            placeholder="Nama Produk"
                            className="text-sm"
                            required
                          />
                        </div>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="mt-6 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Mobile: Stack vertically, Desktop: Grid */}
                      <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Jumlah</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 1)}
                            className="text-sm"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Harga Modal</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.basePrice || ""}
                            onChange={(e) => updateItem(index, "basePrice", parseFloat(e.target.value) || 0)}
                            placeholder="50000"
                            className="text-sm"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Harga Jual</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.sellingPrice || ""}
                            onChange={(e) => updateItem(index, "sellingPrice", parseFloat(e.target.value) || 0)}
                            placeholder="75000"
                            className="text-sm"
                            required
                          />
                        </div>
                      </div>
                      
                      {item.profit !== 0 && (
                        <div className="text-sm p-2 rounded-md bg-gray-100">
                          <span className="text-muted-foreground">Untung: </span>
                          <span className={item.profit > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {formatRupiah(item.profit)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {totalProfit !== 0 && (
                <div className={`p-4 rounded-lg border-2 ${totalProfit > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-sm font-semibold text-center">
                    Total Keuntungan: <span className={`text-lg ${totalProfit > 0 ? "text-green-600" : "text-red-600"}`}>{formatRupiah(totalProfit)}</span>
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="buyerName" className="text-sm font-medium mb-2 block">Nama Pembeli</Label>
                <Input
                  id="buyerName"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Contoh: Bu Siti"
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                <div>
                  <Label htmlFor="paymentMethod" className="text-sm font-medium mb-2 block">Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                      <SelectItem value="Transfer">Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentStatus" className="text-sm font-medium mb-2 block">Status Pembayaran</Label>
                  <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid">Lunas</SelectItem>
                      <SelectItem value="Pending">Belum Lunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-sm font-medium mb-2 block">Catatan / ETA</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Dikirim besok pagi"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
                  size="lg"
                >
                  {editingTransaction ? "Perbarui" : "Simpan"} Penjualan
                </Button>
                {editingTransaction && onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="sm:w-auto">
                    Batal
                  </Button>
                )}
              </div>
            </form>
          </TabsContent>

          <TabsContent value="stock">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="stockProductName" className="text-sm font-medium mb-2 block">Nama Produk</Label>
                <Input
                  id="stockProductName"
                  value={stockProductName}
                  onChange={(e) => setStockProductName(e.target.value)}
                  placeholder="Contoh: Baju Gamis"
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                <div>
                  <Label htmlFor="stockQuantity" className="text-sm font-medium mb-2 block">Jumlah</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="stockBasePrice" className="text-sm font-medium mb-2 block">Harga Modal</Label>
                  <Input
                    id="stockBasePrice"
                    type="number"
                    min="0"
                    value={stockBasePrice}
                    onChange={(e) => setStockBasePrice(e.target.value)}
                    placeholder="50000"
                    className="text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="stockNotes" className="text-sm font-medium mb-2 block">Catatan</Label>
                <Textarea
                  id="stockNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Warna hitam, ukuran L"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
                  size="lg"
                >
                  {editingTransaction ? "Perbarui" : "Simpan"} Stok
                </Button>
                {editingTransaction && onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="sm:w-auto">
                    Batal
                  </Button>
                )}
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
