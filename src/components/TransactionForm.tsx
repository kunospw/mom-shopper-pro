import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction, PaymentMethod, PaymentStatus } from "@/types/transaction";
import { formatRupiah } from "@/lib/currency";
import { toast } from "sonner";

interface TransactionFormProps {
  onSubmit: (transaction: Transaction) => void;
  editingTransaction?: Transaction | null;
  onCancel?: () => void;
}

export const TransactionForm = ({ onSubmit, editingTransaction, onCancel }: TransactionFormProps) => {
  const [productName, setProductName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRIS");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingTransaction) {
      setProductName(editingTransaction.productName);
      setBasePrice(editingTransaction.basePrice.toString());
      setSellingPrice(editingTransaction.sellingPrice.toString());
      setBuyerName(editingTransaction.buyerName);
      setPaymentMethod(editingTransaction.paymentMethod);
      setPaymentStatus(editingTransaction.paymentStatus);
      setNotes(editingTransaction.notes);
    }
  }, [editingTransaction]);

  const calculateProfit = () => {
    const base = parseFloat(basePrice) || 0;
    const selling = parseFloat(sellingPrice) || 0;
    return selling - base;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName || !basePrice || !sellingPrice || !buyerName) {
      toast.error("Mohon lengkapi semua field yang wajib diisi");
      return;
    }

    const profit = calculateProfit();

    const transaction: Transaction = {
      id: editingTransaction?.id || Date.now().toString(),
      productName,
      basePrice: parseFloat(basePrice),
      sellingPrice: parseFloat(sellingPrice),
      buyerName,
      paymentMethod,
      paymentStatus,
      notes,
      date: editingTransaction?.date || new Date().toISOString(),
      profit,
    };

    onSubmit(transaction);

    // Reset form if not editing
    if (!editingTransaction) {
      setProductName("");
      setBasePrice("");
      setSellingPrice("");
      setBuyerName("");
      setPaymentMethod("QRIS");
      setPaymentStatus("Pending");
      setNotes("");
    }

    toast.success(editingTransaction ? "Transaksi berhasil diupdate" : "Transaksi berhasil ditambahkan");
  };

  const profit = calculateProfit();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingTransaction ? "Edit Transaksi" : "Tambah Transaksi Baru"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nama Produk *</Label>
            <Input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Tas Selempang Wanita"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Harga Modal *</Label>
              <Input
                id="basePrice"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Harga Jual *</Label>
              <Input
                id="sellingPrice"
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {(basePrice || sellingPrice) && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Keuntungan:{" "}
                <span className={profit >= 0 ? "text-success" : "text-destructive"}>
                  {formatRupiah(profit)}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="buyerName">Nama Pembeli *</Label>
            <Input
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Nama pembeli"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentStatus">Status Pembayaran</Label>
              <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}>
                <SelectTrigger id="paymentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paid">Lunas</SelectItem>
                  <SelectItem value="Pending">Belum Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan / ETA</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan atau estimasi waktu pengiriman"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              {editingTransaction ? "Update Transaksi" : "Simpan Transaksi"}
            </Button>
            {editingTransaction && onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Batal
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
