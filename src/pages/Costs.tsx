import { useEffect, useState } from "react";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import type { CatalogProduct } from "@/lib/catalog";
import { Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useBooks } from "@/contexts/BooksContext";
import {
  deleteExpense,
  deletePurchase,
  newId,
  saveExpense,
  savePurchase,
} from "@/lib/books-storage";
import type { Expense, ExpenseCategory, Purchase } from "@/types/books";
import { formatRupiah } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { smallDialogClass } from "@/lib/utils";

const categories: Record<ExpenseCategory, string> = {
  ongkir: "Ongkir",
  packaging: "Kemasan",
  iklan: "Iklan",
  admin: "Biaya admin",
  lainnya: "Lainnya",
};
const today = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => Math.max(0, Math.round(Number(v)) || 0);

function PurchaseDialog({ onClose }: { onClose: () => void }) {
  const books = useBooks();
  const [supplier, setSupplier] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [shipping, setShipping] = useState("");
  const [date, setDate] = useState(today());
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    getOwnerCatalog().then((c) => setCatalog(c.products)).catch(() => setCatalog([]));
  }, []);
  const tracked = catalog.filter((p) => books.inventory[p.id]?.stock != null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || num(cost) <= 0 || num(qty) < 1)
      return setError("Isi nama barang, jumlah, dan harga beli lebih dari nol.");
    setSaving(true);
    try {
      const purchase: Purchase = {
        id: newId("purchases"),
        date: new Date(date).toISOString(),
        supplier: supplier.trim(),
        items: [{ ...(productId ? { productId } : {}), name: name.trim(), quantity: num(qty), unitCost: num(cost) }],
        shipping: num(shipping),
        total: num(qty) * num(cost) + num(shipping),
        notes: "",
      };
      await savePurchase(purchase);
      await books.reload();
      toast.success("Pembelian tersimpan");
      onClose();
    } catch {
      setError("Pembelian belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-2"><Label htmlFor="pu-name">Nama barang</Label><Input id="pu-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {tracked.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="pu-product">Tambah ke stok produk (opsional)</Label>
          <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
            <SelectTrigger id="pu-product"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak dikaitkan</SelectItem>
              {tracked.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="pu-qty">Jumlah</Label><Input id="pu-qty" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="pu-cost">Harga beli satuan (Rp)</Label><Input id="pu-cost" type="number" inputMode="numeric" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="pu-ship">Ongkir pembelian (Rp)</Label><Input id="pu-ship" type="number" inputMode="numeric" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="pu-sup">Pemasok (opsional)</Label><Input id="pu-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="pu-date">Tanggal</Label><Input id="pu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <p className="text-sm">Total: <strong>{formatRupiah(num(qty) * num(cost) + num(shipping))}</strong></p>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan pembelian"}</Button>
    </form>
  );
}

function ExpenseDialog({ onClose }: { onClose: () => void }) {
  const books = useBooks();
  const [category, setCategory] = useState<ExpenseCategory>("ongkir");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (num(amount) <= 0) return setError("Isi jumlah biaya lebih dari nol.");
    setSaving(true);
    try {
      await saveExpense({ id: newId("expenses"), date: new Date(date).toISOString(), category, amount: num(amount), note: note.trim() });
      await books.reload();
      toast.success("Biaya tersimpan");
      onClose();
    } catch {
      setError("Biaya belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor="ex-cat">Jenis biaya</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger id="ex-cat"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(categories).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ex-amt">Jumlah (Rp)</Label><Input id="ex-amt" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="ex-date">Tanggal</Label><Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="ex-note">Catatan (opsional)</Label><Input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan biaya"}</Button>
    </form>
  );
}

export default function Costs() {
  const books = useBooks();
  const [params] = useSearchParams();
  const initial = params.get("new");
  const [dialog, setDialog] = useState<"purchase" | "expense" | null>(
    initial === "purchase" || initial === "expense" ? initial : null,
  );
  async function remove(action: () => Promise<void>, label: string) {
    try {
      await action();
      await books.reload();
      toast.success(`${label} dihapus`);
    } catch {
      toast.error(`${label} belum terhapus. Coba lagi.`);
    }
  }
  const dateLabel = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pembelian & biaya</h1>
          <p className="mt-2 text-sm text-muted-foreground">Catat belanja stok dan biaya usaha supaya laba bersih akurat.</p>
        </div>
      </header>
      {books.loading ? <Skeleton className="h-40" role="status" aria-label="Memuat" /> : books.error ? (
        <Card><CardContent className="space-y-3 p-6"><p role="alert">Data belum dapat dimuat.</p><Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button></CardContent></Card>
      ) : (
        <Tabs defaultValue={initial === "expense" ? "expenses" : "purchases"}>
          <TabsList>
            <TabsTrigger value="purchases">Pembelian stok</TabsTrigger>
            <TabsTrigger value="expenses">Biaya usaha</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases" className="space-y-3">
            <Button onClick={() => setDialog("purchase")}><Plus /> Catat pembelian</Button>
            {books.purchases.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Belum ada pembelian. Catat belanja stok pertama Anda.</CardContent></Card> : (
              <ul className="space-y-2">{books.purchases.map((p: Purchase) => (
                <li key={p.id}><Card><CardContent className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0"><span className="block font-medium">{p.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</span><span className="block text-xs text-muted-foreground">{dateLabel(p.date)}{p.supplier && ` · ${p.supplier}`}</span></span>
                  <span className="flex items-center gap-2"><strong>{formatRupiah(p.total)}</strong>
                    <Button variant="ghost" size="icon" aria-label={`Hapus pembelian ${p.items[0]?.name ?? ""}`} onClick={() => void remove(() => deletePurchase(p), "Pembelian")}><Trash2 /></Button></span>
                </CardContent></Card></li>
              ))}</ul>
            )}
          </TabsContent>
          <TabsContent value="expenses" className="space-y-3">
            <Button onClick={() => setDialog("expense")}><Plus /> Catat biaya</Button>
            {books.expenses.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Belum ada biaya usaha. Catat ongkir, kemasan, atau iklan agar laba bersih tidak terlalu tinggi.</CardContent></Card> : (
              <ul className="space-y-2">{books.expenses.map((e: Expense) => (
                <li key={e.id}><Card><CardContent className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0"><span className="block font-medium">{categories[e.category]}</span><span className="block text-xs text-muted-foreground">{dateLabel(e.date)}{e.note && ` · ${e.note}`}</span></span>
                  <span className="flex items-center gap-2"><strong>{formatRupiah(e.amount)}</strong>
                    <Button variant="ghost" size="icon" aria-label={`Hapus biaya ${categories[e.category]}`} onClick={() => void remove(() => deleteExpense(e.id), "Biaya")}><Trash2 /></Button></span>
                </CardContent></Card></li>
              ))}</ul>
            )}
          </TabsContent>
        </Tabs>
      )}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className={smallDialogClass}>
          <DialogHeader>
            <DialogTitle>{dialog === "purchase" ? "Catat pembelian stok" : "Catat biaya usaha"}</DialogTitle>
            <DialogDescription>{dialog === "purchase" ? "Barang yang Anda beli untuk dijual lagi." : "Biaya di luar modal barang."}</DialogDescription>
          </DialogHeader>
          {dialog === "purchase" && <PurchaseDialog onClose={() => setDialog(null)} />}
          {dialog === "expense" && <ExpenseDialog onClose={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
