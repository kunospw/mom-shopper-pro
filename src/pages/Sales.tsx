import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { useAuth } from "@/contexts/AuthContext";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import { saveCustomer, saveSale, deleteSale, newId } from "@/lib/books-storage";
import { fulfillmentLabels, paymentLabels } from "@/lib/books";
import type { CatalogProduct } from "@/lib/catalog";
import type { Sale, SaleInput } from "@/types/books";
import { formatRupiah } from "@/lib/currency";
import { SaleForm } from "@/components/SaleForm";
import { SaleDetail } from "@/components/SaleDetail";
import { InvoiceModal } from "@/components/InvoiceModal";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

export default function Sales() {
  const { user } = useAuth();
  const books = useBooks();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [invoice, setInvoice] = useState<Sale | null>(null);
  const [dirty, setDirty] = useState(false);
  const editId = params.get("edit");
  const viewId = params.get("view");
  const creating = params.get("new") === "1";
  const editorOpen = creating || !!editId;
  const editing = editId ? books.sales.find((s) => s.id === editId) : undefined;
  const blocker = useUnsavedChanges(editorOpen && dirty);
  const q = params.get("q") ?? "";
  const pay = params.get("pay") ?? "all";
  const ful = params.get("ful") ?? "all";

  useEffect(() => {
    // Catalog is optional here: sales still work with free-text items.
    getOwnerCatalog()
      .then((c) => setProducts(c.products))
      .catch(() => setProducts([]));
  }, [user?.uid]);
  useEffect(() => {
    if (!editorOpen) setDirty(false);
  }, [editorOpen]);

  const rows = useMemo(
    () =>
      books.sales.filter(
        (s) =>
          (pay === "all" || s.paymentState === pay) &&
          (ful === "all" || s.fulfillment.status === ful) &&
          (!q ||
            `${s.number} ${s.customer.name} ${s.items.map((i) => i.name).join(" ")}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [books.sales, q, pay, ful],
  );
  const viewing = viewId ? books.sales.find((s) => s.id === viewId) ?? null : null;

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  }

  async function persist(next: Sale) {
    const { id: _i, number: _n, subtotal: _s, total: _t, cost: _c, profit: _p, paid: _pd, balance: _b, paymentState: _ps, ...input } = next;
    await saveSale(input, books.sales.find((s) => s.id === next.id));
    await books.reload();
  }
  async function submit(input: SaleInput) {
    let customerId = input.customerId;
    if (!customerId && input.customer.name) {
      customerId = newId("customers");
      await saveCustomer({
        id: customerId,
        name: input.customer.name,
        whatsapp: input.customer.whatsapp,
        address: input.customer.address,
        note: "",
      });
    }
    const month = input.date.slice(0, 7);
    const sequence =
      books.sales.filter((s) => s.date.slice(0, 7) === month).length + 1;
    const saved = await saveSale({ ...input, customerId }, editing, { sequence });
    await books.reload();
    // Leaving the form is only safe once the write has succeeded.
    flushSync(() => setDirty(false));
    toast.success(editing ? "Perubahan tersimpan" : `Penjualan ${saved.number} tersimpan`);
    go({ new: null, edit: null, view: saved.id });
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Penjualan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Catat pesanan, DP, pelunasan, dan pengiriman dalam satu tempat.
          </p>
        </div>
        <Button onClick={() => go({ new: "1", edit: null })}>
          <Plus /> Catat penjualan
        </Button>
      </header>

      <section aria-label="Cari dan saring penjualan" className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor="sales-q">Cari</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="sales-q" className="pl-9" placeholder="Nomor, pelanggan, atau produk" value={q} onChange={(e) => update("q", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2 sm:w-44">
          <Label htmlFor="sales-pay">Pembayaran</Label>
          <Select value={pay} onValueChange={(v) => update("pay", v)}>
            <SelectTrigger id="sales-pay"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {Object.entries(paymentLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:w-44">
          <Label htmlFor="sales-ful">Pengiriman</Label>
          <Select value={ful} onValueChange={(v) => update("ful", v)}>
            <SelectTrigger id="sales-ful"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {Object.entries(fulfillmentLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {books.loading ? (
        <div role="status" className="space-y-3">
          <Skeleton className="h-20" /><Skeleton className="h-20" />
          <p className="text-sm text-muted-foreground">Memuat penjualan…</p>
        </div>
      ) : books.error ? (
        <Card><CardContent className="space-y-3 p-6">
          <p role="alert">Penjualan belum dapat dimuat. Periksa koneksi Anda.</p>
          <Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button>
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          {books.sales.length === 0
            ? "Belum ada penjualan. Catat penjualan pertama Anda, atau tunggu pesanan masuk dari katalog."
            : "Tidak ada penjualan yang cocok dengan pencarian ini."}
        </CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="p-0">
                  <Link
                    to={`/sales?${(() => { const n = new URLSearchParams(params); n.set("view", s.id); return n; })()}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{s.customer.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.number} · {new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} · {s.items.map((i) => i.name).join(", ")}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={s.paymentState === "paid" ? "default" : "secondary"}>{paymentLabels[s.paymentState]}</Badge>
                        <Badge variant="outline">{fulfillmentLabels[s.fulfillment.status]}</Badge>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold">{formatRupiah(s.total)}</span>
                      {s.balance > 0 && s.fulfillment.status !== "cancelled" && (
                        <span className="block text-xs text-muted-foreground">Sisa {formatRupiah(s.balance)}</span>
                      )}
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => !open && go({ new: null, edit: null })}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editing ? `Ubah ${editing.number}` : "Catat penjualan"}</DialogTitle>
            <DialogDescription>
              Isi pelanggan, produk, dan pembayaran. DP atau pelunasan bisa dicatat sekarang atau nanti.
            </DialogDescription>
          </DialogHeader>
          {editId && !editing ? (
            <p>Penjualan tidak ditemukan.</p>
          ) : (
            <SaleForm
              key={editId ?? "new"}
              sale={editing}
              products={products}
              customers={books.customers}
              inventory={books.inventory}
              onSubmit={submit}
              onCancel={() => go({ new: null, edit: null })}
              onDirtyChange={setDirty}
            />
          )}
        </DialogContent>
      </Dialog>

      <SaleDetail
        sale={viewing}
        onClose={() => go({ view: null })}
        onChange={persist}
        onEdit={(s) => go({ view: null, edit: s.id })}
        onDelete={async (s) => {
          await deleteSale(s);
          await books.reload();
          go({ view: null });
          toast.success(`Penjualan ${s.number} dihapus`);
        }}
        onInvoice={setInvoice}
      />
      <InvoiceModal sale={invoice} isOpen={!!invoice} onClose={() => setInvoice(null)} />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
