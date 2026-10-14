import { useState, useEffect } from "react";
import {
  Transaction,
  ProductItem,
  PaymentMethod,
  PaymentStatus,
} from "@/types/transaction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/currency";
import { Plus, Trash2 } from "lucide-react";

interface TransactionFormProps {
  onSubmit: (transaction: Transaction) => Promise<void> | void;
  defaultType?: "sale" | "stock";
  onDirtyChange?: (dirty: boolean) => void;
  editingTransaction?: Transaction | null;
  onCancel?: () => void;
}

export const TransactionForm = ({
  onSubmit,
  editingTransaction,
  onCancel,
  defaultType = "sale",
  onDirtyChange,
}: TransactionFormProps) => {
  const [entryType, setEntryType] = useState<"sale" | "stock">(defaultType);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Sale fields
  const [items, setItems] = useState<ProductItem[]>([
    { productName: "", quantity: 1, basePrice: 0, sellingPrice: 0, profit: 0 },
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
  const [transactionDate, setTransactionDate] = useState<string>("");

  // Helper function to convert ISO string to local datetime string for input
  const isoToLocalDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to convert local datetime string to ISO string
  const localDateTimeToIso = (localDateTime: string): string => {
    if (!localDateTime) return new Date().toISOString();
    return new Date(localDateTime).toISOString();
  };

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
      // Set date from existing transaction
      setTransactionDate(
        isoToLocalDateTime(editingTransaction.date || new Date().toISOString()),
      );
    } else {
      // Set to current date/time for new transactions
      setTransactionDate(isoToLocalDateTime(new Date().toISOString()));
    }
  }, [editingTransaction]);

  const addItem = () => {
    setDirty(true);
    setItems([
      ...items,
      {
        productName: "",
        quantity: 1,
        basePrice: 0,
        sellingPrice: 0,
        profit: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setDirty(true);
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (
    index: number,
    field: keyof ProductItem,
    value: string | number,
  ) => {
    setDirty(true);
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (
      field === "basePrice" ||
      field === "sellingPrice" ||
      field === "quantity"
    ) {
      const base = parseFloat(newItems[index].basePrice.toString()) || 0;
      const selling = parseFloat(newItems[index].sellingPrice.toString()) || 0;
      const qty = parseFloat(newItems[index].quantity.toString()) || 1;
      newItems[index].profit = (selling - base) * qty;
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (entryType === "sale") {
      if (
        !buyerName ||
        items.some(
          (item) =>
            !item.productName || item.basePrice <= 0 || item.sellingPrice <= 0,
        )
      ) {
        toast.error("Mohon lengkapi semua field yang diperlukan");
        return;
      }

      const totalBasePrice = items.reduce(
        (sum, item) => sum + item.basePrice * item.quantity,
        0,
      );
      const totalSellingPrice = items.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0,
      );
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
        date: localDateTimeToIso(transactionDate),
      };

      await persist(transaction);
    } else {
      if (
        !stockProductName ||
        !stockBasePrice ||
        parseFloat(stockBasePrice) <= 0
      ) {
        toast.error("Mohon lengkapi semua field yang diperlukan");
        return;
      }

      const transaction: Transaction = {
        id: editingTransaction?.id || Date.now().toString(),
        type: "stock",
        productName: stockProductName,
        quantity: parseInt(stockQuantity) || 1,
        basePrice: parseFloat(stockBasePrice),
        notes,
        date: localDateTimeToIso(transactionDate),
      };

      await persist(transaction);
    }
  };

  async function persist(transaction: Transaction) {
    setSaving(true);
    try {
      await onSubmit(transaction);
      setDirty(false);
      toast.success(
        editingTransaction
          ? "Transaksi diperbarui"
          : transaction.type === "sale"
            ? "Penjualan disimpan"
            : "Pembelian stok disimpan",
      );
    } catch {
      toast.error(
        "Transaksi belum tersimpan. Isian Anda tetap tersedia; silakan coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);

  return (
    <Card
      className="min-w-0 border-0 shadow-none"
      onChangeCapture={() => setDirty(true)}
    >
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg">
          {editingTransaction ? "Detail transaksi" : "Isi detail transaksi"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <fieldset disabled={saving} className="min-w-0">
          <Tabs
            value={entryType}
            onValueChange={(v) => {
              setEntryType(v as "sale" | "stock");
              setDirty(true);
            }}
            className="w-full"
          >
            <TabsList className="grid h-auto w-full grid-cols-2 mb-4">
              <TabsTrigger
                value="sale"
                className="min-h-11 whitespace-normal px-2 py-2"
                disabled={!!editingTransaction || saving}
              >
                Penjualan
              </TabsTrigger>
              <TabsTrigger
                value="stock"
                className="min-h-11 whitespace-normal px-2 py-2"
                disabled={!!editingTransaction || saving}
              >
                Pembelian stok
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sale">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <Label>Produk</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addItem}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Produk
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg space-y-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Input
                              value={item.productName}
                              onChange={(e) =>
                                updateItem(index, "productName", e.target.value)
                              }
                              aria-label={`Nama produk ${index + 1}`}
                              placeholder="Nama Produk"
                              required
                            />
                          </div>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              aria-label={`Hapus produk ${index + 1}`}
                              variant="ghost"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div className="col-span-2 min-w-0 sm:col-span-1">
                            <Label
                              htmlFor={`quantity-${index}`}
                              className="text-xs"
                            >
                              Jumlah
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              id={`quantity-${index}`}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "quantity",
                                  parseFloat(e.target.value) || 1,
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`base-${index}`}
                              className="text-xs"
                            >
                              Harga modal
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              id={`base-${index}`}
                              value={item.basePrice || ""}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "basePrice",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="50000"
                              required
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`selling-${index}`}
                              className="text-xs"
                            >
                              Harga jual
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              id={`selling-${index}`}
                              value={item.sellingPrice || ""}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "sellingPrice",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="75000"
                              required
                            />
                          </div>
                        </div>

                        {item.profit !== 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Untung:{" "}
                            </span>
                            <span
                              className={
                                item.profit > 0
                                  ? "text-success font-medium"
                                  : "text-destructive font-medium"
                              }
                            >
                              {formatRupiah(item.profit)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {totalProfit !== 0 && (
                  <div
                    className={`p-3 rounded-lg ${totalProfit > 0 ? "bg-success/10" : "bg-destructive/10"}`}
                  >
                    <p className="text-sm font-medium">
                      Total Keuntungan:{" "}
                      <span
                        className={
                          totalProfit > 0 ? "text-success" : "text-destructive"
                        }
                      >
                        {formatRupiah(totalProfit)}
                      </span>
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="buyerName">Nama Pembeli</Label>
                  <Input
                    id="buyerName"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Contoh: Bu Siti"
                    required
                  />
                </div>

                <div>
                  <Label
                    htmlFor="transactionDate"
                    className="text-base font-semibold mb-3 block text-foreground"
                  >
                    Tanggal & Waktu
                  </Label>
                  <Input
                    id="transactionDate"
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="text-base h-12 border border-border"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) =>
                        setPaymentMethod(value as PaymentMethod)
                      }
                    >
                      <SelectTrigger>
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
                    <Label htmlFor="paymentStatus">Status Pembayaran</Label>
                    <Select
                      value={paymentStatus}
                      onValueChange={(value) =>
                        setPaymentStatus(value as PaymentStatus)
                      }
                    >
                      <SelectTrigger>
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
                  <Label htmlFor="notes">Catatan / ETA</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Dikirim besok pagi"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="min-w-0 flex-1">
                    {saving
                      ? "Menyimpan…"
                      : editingTransaction
                        ? "Perbarui penjualan"
                        : "Simpan penjualan"}
                  </Button>
                  {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Batal
                    </Button>
                  )}
                </div>
              </form>
            </TabsContent>

            <TabsContent value="stock">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="stockProductName">Nama Produk</Label>
                  <Input
                    id="stockProductName"
                    value={stockProductName}
                    onChange={(e) => setStockProductName(e.target.value)}
                    placeholder="Contoh: Baju Gamis"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stockQuantity">Jumlah</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min="1"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stockBasePrice">Harga Modal</Label>
                    <Input
                      id="stockBasePrice"
                      type="number"
                      min="0"
                      value={stockBasePrice}
                      onChange={(e) => setStockBasePrice(e.target.value)}
                      placeholder="50000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="stockTransactionDate"
                    className="text-base font-semibold mb-3 block text-foreground"
                  >
                    Tanggal & Waktu
                  </Label>
                  <Input
                    id="stockTransactionDate"
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="text-base h-12 border border-border"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="stockNotes">Catatan</Label>
                  <Textarea
                    id="stockNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Warna hitam, ukuran L"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="min-w-0 flex-1">
                    {saving
                      ? "Menyimpan…"
                      : editingTransaction
                        ? "Perbarui pembelian"
                        : "Simpan pembelian"}
                  </Button>
                  {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Batal
                    </Button>
                  )}
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </fieldset>
      </CardContent>
    </Card>
  );
};
