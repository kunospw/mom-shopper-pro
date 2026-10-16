import { useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { customerStats, waNumber } from "@/lib/books";
import { newId, saveCustomer } from "@/lib/books-storage";
import type { Customer } from "@/types/books";
import { formatRupiah } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { smallDialogClass } from "@/lib/utils";

export default function Customers() {
  const books = useBooks();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [draft, setDraft] = useState<Customer>({ id: "", name: "", whatsapp: "", address: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(
    () => books.customers.map((c) => ({ c, stats: customerStats(c, books.sales) })),
    [books.customers, books.sales],
  );
  function open(target: Customer | "new") {
    setDraft(target === "new" ? { id: newId("customers"), name: "", whatsapp: "", address: "", note: "" } : target);
    setError("");
    setEditing(target);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Isi nama pelanggan.");
    setSaving(true);
    try {
      await saveCustomer({ ...draft, name: draft.name.trim(), whatsapp: waNumber(draft.whatsapp) });
      await books.reload();
      toast.success("Pelanggan tersimpan");
      setEditing(null);
    } catch {
      setError("Pelanggan belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pelanggan</h1>
          <p className="mt-2 text-sm text-muted-foreground">Lihat riwayat belanja dan tagihan yang belum lunas.</p>
        </div>
        <Button onClick={() => open("new")}><Plus /> Tambah pelanggan</Button>
      </header>
      {books.loading ? <Skeleton className="h-40" role="status" aria-label="Memuat pelanggan" /> : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Belum ada pelanggan. Pelanggan tersimpan otomatis saat Anda mencatat penjualan.</CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ c, stats }) => (
            <li key={c.id}>
              <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{stats.orders} pesanan · belanja {formatRupiah(stats.spent)}</span>
                  {stats.debt > 0 && <span className="mt-1 block text-sm font-medium">Belum dibayar {formatRupiah(stats.debt)}</span>}
                </span>
                <span className="flex gap-2">
                  {stats.debt > 0 && waNumber(c.whatsapp) && (
                    <Button asChild variant="outline">
                      <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNumber(c.whatsapp)}?text=${encodeURIComponent(`Halo ${c.name}, mengingatkan sisa tagihan pesanan Anda sebesar ${formatRupiah(stats.debt)}. Terima kasih!`)}`}>
                        <MessageCircle /> Tagih via WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => open(c)}>Ubah</Button>
                </span>
              </CardContent></Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={smallDialogClass}>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Tambah pelanggan" : "Ubah pelanggan"}</DialogTitle>
            <DialogDescription>Data ini hanya terlihat oleh Anda.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="space-y-2"><Label htmlFor="cu-name">Nama</Label><Input id="cu-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="cu-wa">WhatsApp</Label><Input id="cu-wa" inputMode="tel" placeholder="6281234567890" value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="cu-addr">Alamat</Label><Textarea id="cu-addr" rows={2} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="cu-note">Catatan</Label><Input id="cu-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan pelanggan"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
