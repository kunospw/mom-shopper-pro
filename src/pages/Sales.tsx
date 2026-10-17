import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, Plus, Search } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { useAuth } from "@/contexts/AuthContext";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import { saveCustomer, saveSale, deleteSale, newId } from "@/lib/books-storage";
import { toInput } from "@/lib/books";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog";
import type { Sale, SaleInput } from "@/types/books";
import { orderCode } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { SaleForm } from "@/components/SaleForm";
import { SaleDetail } from "@/components/SaleDetail";
import { InvoiceModal } from "@/components/InvoiceModal";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { FulfillmentChip, PaymentChip } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildReport } from "@/lib/report";
import { monthKey, periodRange } from "@/lib/period";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const open = (s: Sale) => s.fulfillment.status !== "cancelled";
const filters: { id: string; label: string; test: (s: Sale) => boolean }[] = [
  { id: "all", label: "Semua", test: () => true },
  { id: "due", label: "Belum lunas", test: (s) => open(s) && s.balance > 0 },
  { id: "ship", label: "Perlu dikirim", test: (s) => ["confirmed", "packed"].includes(s.fulfillment.status) },
  { id: "sent", label: "Dalam pengiriman", test: (s) => s.fulfillment.status === "shipped" },
  { id: "done", label: "Selesai", test: (s) => ["done", "delivered"].includes(s.fulfillment.status) && s.balance === 0 },
  { id: "cancelled", label: "Dibatalkan", test: (s) => s.fulfillment.status === "cancelled" },
];

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
  const confirmId = params.get("confirm");
  const confirming = confirmId
    ? books.orders.find((o) => o.id === confirmId && o.status === "pending")
    : undefined;
  const editorOpen = creating || !!editId || !!confirmId;
  const editing = editId ? books.sales.find((s) => s.id === editId) : undefined;
  const blocker = useUnsavedChanges(editorOpen && dirty);
  const q = params.get("q") ?? "";
  const filter = params.get("f") ?? "all";

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
          (filters.find((f) => f.id === filter)?.test(s) ?? true) &&
          (!q ||
            `${s.number} ${s.customer.name} ${s.items.map((i) => i.name).join(" ")}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [books.sales, q, filter],
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
    await saveSale(toInput(next), books.sales.find((s) => s.id === next.id));
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
    toast.success(
      editing
        ? "Perubahan tersimpan"
        : confirming
          ? `Pesanan #${orderCode(confirming.id)} dikonfirmasi sebagai ${saved.number}`
          : `Penjualan ${saved.number} tersimpan`,
    );
    go({ new: null, edit: null, confirm: null, view: saved.id });
  }

  const ledger = { sales: books.sales, purchases: books.purchases, expenses: books.expenses };
  const monthReport = buildReport(ledger, periodRange("this-month"));
  const monthName = new Date().toLocaleDateString("id-ID", { month: "long" });
  const toShip = books.sales.filter(filters[2].test).length;
  const months = [...new Set(books.sales.map((s) => monthKey(s.date)))].sort().reverse();
  const month = params.get("m") ?? "";
  const shown = month ? rows.filter((s) => monthKey(s.date) === month) : rows;
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  };
  const itemsText = (s: Sale) => s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
  const viewHref = (id: string) => {
    const n = new URLSearchParams(params);
    n.set("view", id);
    return `/sales?${n}`;
  };
  const paymentChip = (s: Sale) => <PaymentChip state={s.fulfillment.status === "cancelled" && s.refundDue > 0 ? "refund-due" : s.paymentState} />;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Penjualan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catat pesanan, DP, pelunasan, dan pengiriman dalam satu tempat.</p>
        </div>
        <Button className="h-11 rounded-[10px]" onClick={() => go({ new: "1", edit: null })}>
          <Plus /> Catat penjualan
        </Button>
      </header>

      <section aria-label="Ringkasan bulan ini" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `Penjualan ${monthName}`, value: formatRupiah(monthReport.revenue) },
          { label: "Sudah dibayar", value: formatRupiah(monthReport.cashNet) },
          { label: "Sisa tagihan", value: formatRupiah(monthReport.outstandingNow), tone: "text-request" },
          { label: "Perlu dikirim", value: `${toShip} penjualan` },
        ].map((stat) => (
          <Card key={stat.label} className="px-4 py-3.5">
            <p className="text-[13px] text-muted-foreground">{stat.label}</p>
            <p className={cn("num mt-0.5 text-lg font-bold sm:text-xl", stat.tone)}>{stat.value}</p>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-[18px]">
          <div role="group" aria-label="Saring penjualan" className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide md:flex-wrap md:overflow-visible">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => update("f", f.id)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  filter === f.id ? "bg-foreground font-semibold text-background" : "border border-input font-medium hover:bg-accent",
                )}
              >
                {f.label}
                {f.id !== "cancelled" && <span className="num ml-1.5 opacity-70">{books.sales.filter(f.test).length}</span>}
              </button>
            ))}
          </div>
          <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring sm:w-64">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Cari penjualan</span>
            <input id="sales-q" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Cari nama atau nomor invoice" value={q} onChange={(e) => update("q", e.target.value)} />
          </label>
          <label className="sr-only" htmlFor="sales-month">Bulan</label>
          <select
            id="sales-month"
            value={month}
            onChange={(e) => update("m", e.target.value)}
            className="h-10 rounded-[10px] border border-input bg-card px-3 text-sm"
          >
            <option value="">Semua bulan</option>
            {months.map((key) => (
              <option key={key} value={key}>{monthLabel(key)}</option>
            ))}
          </select>
        </div>

        {books.loading ? (
          <div role="status" className="space-y-3 p-4">
            <Skeleton className="h-14" /><Skeleton className="h-14" />
            <p className="text-sm text-muted-foreground">Memuat penjualan…</p>
          </div>
        ) : books.error ? (
          <div className="space-y-3 p-6">
            <p role="alert">Penjualan belum dapat dimuat. Periksa koneksi Anda.</p>
            <Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border-t p-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            {books.sales.length === 0
              ? "Belum ada penjualan. Catat penjualan pertama Anda, atau tunggu pesanan masuk dari katalog."
              : "Tidak ada penjualan untuk filter ini."}
            {books.sales.length > 0 && (
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Tampilkan semua
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-y bg-background/60 text-left text-[13px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-[18px] py-2.5 font-medium">No. &amp; tanggal</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Pelanggan</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Sisa</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Pembayaran</th>
                  <th scope="col" className="px-3 py-2.5 pr-[18px] font-medium">Pengiriman</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-accent/60" onClick={() => go({ view: s.id })}>
                    <td className="px-[18px] py-3.5 align-top">
                      <Link to={viewHref(s.id)} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-medium hover:underline">
                        {s.number}
                      </Link>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        {s.channel === "catalog" && <span className="rounded bg-request-soft px-1 text-[11px] font-medium text-request">katalog</span>}
                      </p>
                    </td>
                    <td className="max-w-[260px] px-3 py-3.5 align-top">
                      <p className="font-semibold">{s.customer.name || "Pelanggan"}</p>
                      <p className="truncate text-xs text-muted-foreground">{itemsText(s)}</p>
                    </td>
                    <td className="num px-3 py-3.5 text-right align-top font-semibold">{formatRupiah(s.total)}</td>
                    <td className={cn("num px-3 py-3.5 text-right align-top font-semibold", s.balance > 0 ? "text-request" : "text-muted-foreground")}>
                      {s.balance > 0 && s.fulfillment.status !== "cancelled" ? formatRupiah(s.balance) : "—"}
                    </td>
                    <td className="px-3 py-3.5 align-top">{paymentChip(s)}</td>
                    <td className="px-3 py-3.5 pr-[18px] align-top"><FulfillmentChip status={s.fulfillment.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y border-t md:hidden">
              {shown.map((s) => (
                <li key={s.id}>
                  <Link to={viewHref(s.id)} className="flex items-start justify-between gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="min-w-0">
                      <span className="block font-semibold">{s.customer.name || "Pelanggan"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{s.number}</span> · {new Date(s.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {itemsText(s)}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {paymentChip(s)}
                        <FulfillmentChip status={s.fulfillment.status} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block font-bold">{formatRupiah(s.total)}</span>
                      {s.balance > 0 && s.fulfillment.status !== "cancelled" && (
                        <span className="num block text-xs font-semibold text-request">Sisa {formatRupiah(s.balance)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap justify-between gap-2 border-t px-[18px] py-3 text-[13px] text-muted-foreground">
              <span>Menampilkan {shown.length} penjualan</span>
              <span>Status pembayaran dan pengiriman dicatat terpisah.</span>
            </p>
          </>
        )}
      </Card>

      <Sheet open={editorOpen} onOpenChange={(open) => !open && go({ new: null, edit: null, confirm: null })}>
        <SheetContent side="right" closeLabel="Tutup formulir" className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[1040px]">
          <SheetHeader className="sticky top-0 z-10 border-b bg-card px-5 py-4 pr-16 text-left sm:px-7">
            <SheetTitle className="text-xl">
              {editing ? `Ubah ${editing.number}` : confirmId ? `Konfirmasi pesanan${confirming ? ` #${orderCode(confirming.id)}` : ""}` : "Catat penjualan"}
            </SheetTitle>
            <SheetDescription>
              {confirmId
                ? "Periksa harga dan ongkir, lalu simpan. Pembeli melihat statusnya di halaman pesanan."
                : "Isi pelanggan, produk, dan pembayaran. DP atau pelunasan bisa dicatat sekarang atau nanti."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 sm:p-7">
            {(editId && !editing) || (confirmId && !confirming && !books.loading) ? (
              <p>{confirmId ? "Pesanan ini sudah diproses atau tidak ditemukan." : "Penjualan tidak ditemukan."}</p>
            ) : confirmId && !confirming ? (
              <p role="status">Memuat pesanan…</p>
            ) : (
              <SaleForm
                key={editId ?? confirmId ?? "new"}
                sale={editing}
                prefill={
                  confirming
                    ? {
                        channel: "catalog",
                        orderRequestId: confirming.id,
                        customer: { name: confirming.buyerName, whatsapp: "", address: "" },
                        notes: confirming.note,
                        items: confirming.items.map((item) => ({
                          productId: item.productId,
                          name: item.name,
                          option: item.option,
                          kind: item.kind,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          unitCost: books.inventory[item.productId]?.cost ?? 0,
                        })),
                      }
                    : undefined
                }
                submitLabel={confirming ? "Konfirmasi pesanan" : undefined}
                products={products}
                customers={books.customers}
                inventory={books.inventory}
                onSubmit={submit}
                onCancel={() => go({ new: null, edit: null, confirm: null })}
                onDirtyChange={setDirty}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <SaleDetail
        key={viewing?.id ?? "none"}
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
