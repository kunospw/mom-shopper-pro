import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, MessageCircle, Pencil, Plus, Users } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { customerStats, waNumber } from "@/lib/books";
import { newId, saveCustomer } from "@/lib/books-storage";
import type { Customer } from "@/types/books";
import { formatRupiah } from "@/lib/currency";
import { monthKey } from "@/lib/period";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterChips, SearchBox, StatCard, field } from "@/components/form-parts";
import { FulfillmentChip, PaymentChip } from "@/components/status";
import { toWhatsApp, formatWhatsApp } from "@/lib/store-setup";
import { cn, smallDialogClass } from "@/lib/utils";
import { toast } from "sonner";

/** Customers with this many orders count as "langganan". */
const REGULAR = 3;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const reminder = (c: Customer, debt: number) =>
  `https://wa.me/${waNumber(c.whatsapp)}?text=${encodeURIComponent(`Halo ${c.name}, mengingatkan sisa tagihan pesanan Anda sebesar ${formatRupiah(debt)}. Terima kasih!`)}`;

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink dark:bg-primary/15 dark:text-primary", className)}>
      {initials(name)}
    </span>
  );
}

export default function Customers() {
  const books = useBooks();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [draft, setDraft] = useState<Customer>({ id: "", name: "", whatsapp: "", address: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const q = params.get("q") ?? "";
  const filter = params.get("f") ?? "all";
  const viewId = params.get("view");

  const rows = useMemo(
    () =>
      books.customers
        .map((c) => {
          const stats = customerStats(c, books.sales);
          const last = stats.sales.reduce((latest, s) => (s.date > latest ? s.date : latest), "");
          return { c, stats, last };
        })
        .sort((a, b) => b.last.localeCompare(a.last) || a.c.name.localeCompare(b.c.name, "id")),
    [books.customers, books.sales],
  );
  const filters = [
    { id: "all", label: "Semua", test: () => true },
    { id: "owing", label: "Belum lunas", test: (r: (typeof rows)[number]) => r.stats.debt > 0 },
    { id: "regular", label: "Langganan", test: (r: (typeof rows)[number]) => r.stats.orders >= REGULAR },
  ];
  const active = filters.find((f) => f.id === filter) ?? filters[0];
  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => active.test(r) && (!term || `${r.c.name} ${r.c.whatsapp} ${r.c.address}`.toLowerCase().includes(term)));
  const owing = rows.filter((r) => r.stats.debt > 0);
  const thisMonth = monthKey(new Date());
  const viewing = viewId ? rows.find((r) => r.c.id === viewId) : undefined;

  function setQuery(patch: Record<string, string | null>, replace = true) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  }
  function open(target: Customer | "new") {
    setDraft(target === "new" ? { id: newId("customers"), name: "", whatsapp: "", address: "", note: "" } : target);
    setError("");
    setEditing(target);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Isi nama pelanggan.");
    const wa = toWhatsApp(draft.whatsapp);
    if (draft.whatsapp.trim() && !waNumber(wa)) return setError("Nomor WhatsApp belum lengkap. Contoh: 0812 3456 7890.");
    setSaving(true);
    try {
      await saveCustomer({ ...draft, name: draft.name.trim(), whatsapp: waNumber(wa), address: draft.address.trim(), note: draft.note.trim() });
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Pelanggan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Riwayat belanja dan tagihan setiap pelanggan. Tersimpan otomatis saat Anda mencatat penjualan.</p>
        </div>
        <Button className="h-11 rounded-[10px]" onClick={() => open("new")}>
          <Plus /> Tambah pelanggan
        </Button>
      </header>

      {books.loading ? (
        <div role="status" aria-label="Memuat pelanggan" className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-60" />
        </div>
      ) : books.error ? (
        <Card className="space-y-3 p-6">
          <p role="alert">Pelanggan belum dapat dimuat. Periksa koneksi Anda.</p>
          <Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button>
        </Card>
      ) : (
        <>
          {rows.length > 0 && (
            <section aria-label="Ringkasan pelanggan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Pelanggan" value={rows.length} />
              <StatCard label="Belanja bulan ini" value={rows.filter((r) => r.last && monthKey(r.last) === thisMonth).length} hint="pelanggan" />
              <StatCard label="Belum lunas" value={formatRupiah(owing.reduce((s, r) => s + r.stats.debt, 0))} hint={`${owing.length} pelanggan`} tone={owing.length ? "text-request" : undefined} />
              <StatCard label="Langganan" value={rows.filter((r) => r.stats.orders >= REGULAR).length} hint={`${REGULAR}+ pesanan`} />
            </section>
          )}
          <Card className="overflow-hidden">
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 p-4 sm:p-[18px]">
                <FilterChips label="Saring pelanggan" value={active.id} onChange={(v) => setQuery({ f: v })} options={filters.map((f) => ({ id: f.id, label: f.label, count: rows.filter(f.test).length }))} />
                <SearchBox id="customers-q" label="Cari pelanggan" value={q} onChange={(v) => setQuery({ q: v })} placeholder="Nama, nomor, atau alamat" />
              </div>
            )}
            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 border-t p-10 text-center text-sm text-muted-foreground">
                <Users className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                {rows.length === 0 ? "Belum ada pelanggan. Pelanggan tersimpan otomatis saat Anda mencatat penjualan." : "Tidak ada pelanggan untuk saringan ini."}
                {rows.length > 0 && (
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
                      <th scope="col" className="px-[18px] py-2.5 font-medium">Pelanggan</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Pesanan</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Total belanja</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Belum dibayar</th>
                      <th scope="col" className="px-3 py-2.5 pr-[18px] font-medium">Terakhir belanja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map(({ c, stats, last }) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-accent/60" onClick={() => setQuery({ view: c.id }, false)}>
                        <td className="px-[18px] py-3">
                          <span className="flex items-center gap-3">
                            <Avatar name={c.name} />
                            <span className="min-w-0">
                              <Link to={`/customers?view=${c.id}`} onClick={(e) => e.stopPropagation()} className="block font-semibold hover:underline">{c.name}</Link>
                              <span className="block text-xs text-muted-foreground">{c.whatsapp ? formatWhatsApp(c.whatsapp) : "Tanpa nomor"}</span>
                            </span>
                          </span>
                        </td>
                        <td className="num px-3 py-3 text-right">{stats.orders}</td>
                        <td className="num px-3 py-3 text-right font-semibold">{formatRupiah(stats.spent)}</td>
                        <td className={cn("num px-3 py-3 text-right font-semibold", stats.debt > 0 ? "text-request" : "text-muted-foreground")}>{stats.debt > 0 ? formatRupiah(stats.debt) : "—"}</td>
                        <td className="px-3 py-3 pr-[18px] text-muted-foreground">{last ? shortDate(last) : "Belum ada"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="divide-y border-t md:hidden">
                  {shown.map(({ c, stats }) => (
                    <li key={c.id}>
                      <Link to={`/customers?view=${c.id}`} className="flex items-center gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                        <Avatar name={c.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {stats.orders} pesanan · {formatRupiah(stats.spent)}
                          </span>
                        </span>
                        {stats.debt > 0 && <span className="num shrink-0 text-right text-xs font-semibold text-request">Sisa<br />{formatRupiah(stats.debt)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="border-t px-[18px] py-3 text-[13px] text-muted-foreground">Menampilkan {shown.length} pelanggan</p>
              </>
            )}
          </Card>
        </>
      )}

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setQuery({ view: null }, false)}>
        <SheetContent side="right" closeLabel="Tutup" className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[520px]">
          {viewing && (
            <>
              <SheetHeader className="border-b bg-card px-5 py-5 pr-16 text-left sm:px-7">
                <div className="flex items-center gap-3">
                  <Avatar name={viewing.c.name} className="h-12 w-12 text-base" />
                  <div className="min-w-0">
                    <SheetTitle className="text-xl">{viewing.c.name}</SheetTitle>
                    <SheetDescription>{viewing.c.whatsapp ? formatWhatsApp(viewing.c.whatsapp) : "Belum ada nomor WhatsApp"}</SheetDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3">
                  {waNumber(viewing.c.whatsapp) && (
                    <Button asChild variant="outline">
                      <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNumber(viewing.c.whatsapp)}`}>
                        <MessageCircle /> Chat
                      </a>
                    </Button>
                  )}
                  {viewing.stats.debt > 0 && waNumber(viewing.c.whatsapp) && (
                    <Button asChild>
                      <a target="_blank" rel="noopener noreferrer" href={reminder(viewing.c, viewing.stats.debt)}>
                        <MessageCircle /> Tagih via WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => open(viewing.c)}>
                    <Pencil /> Ubah
                  </Button>
                </div>
              </SheetHeader>
              <div className="space-y-4 p-4 sm:p-7">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Pesanan", value: String(viewing.stats.orders) },
                    { label: "Total belanja", value: formatRupiah(viewing.stats.spent) },
                    { label: "Belum dibayar", value: viewing.stats.debt > 0 ? formatRupiah(viewing.stats.debt) : "Lunas", tone: viewing.stats.debt > 0 ? "text-request" : "text-success" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-card p-3 shadow-card">
                      <dt className="text-xs text-muted-foreground">{s.label}</dt>
                      <dd className={cn("num mt-0.5 text-sm font-bold", s.tone)}>{s.value}</dd>
                    </div>
                  ))}
                </dl>
                {(viewing.c.address || viewing.c.note) && (
                  <div className="space-y-1.5 rounded-xl bg-card p-4 text-sm shadow-card">
                    {viewing.c.address && (
                      <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{viewing.c.address}</p>
                    )}
                    {viewing.c.note && <p className="text-muted-foreground">Catatan: {viewing.c.note}</p>}
                  </div>
                )}
                <section aria-labelledby="customer-history" className="rounded-2xl bg-card shadow-card">
                  <h3 id="customer-history" className="border-b px-4 py-3 text-base font-semibold">Riwayat belanja</h3>
                  {viewing.stats.sales.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Belum ada penjualan untuk pelanggan ini.</p>
                  ) : (
                    <ul className="divide-y">
                      {[...viewing.stats.sales].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                        <li key={s.id}>
                          <Link to={`/sales?view=${s.id}`} className="block px-4 py-3 hover:bg-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block font-mono text-[13px] font-medium">{s.number}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {shortDate(s.date)} · {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                                </span>
                              </span>
                              <span className="num shrink-0 font-semibold">{formatRupiah(s.total)}</span>
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <PaymentChip state={s.paymentState} />
                              <FulfillmentChip status={s.fulfillment.status} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className={smallDialogClass}>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Tambah pelanggan" : "Ubah pelanggan"}</DialogTitle>
            <DialogDescription>Data ini hanya terlihat oleh Anda.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <fieldset disabled={saving} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="cu-name">Nama</Label><input id="cu-name" className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cu-wa">WhatsApp</Label><input id="cu-wa" className={field} type="tel" inputMode="tel" placeholder="0812 3456 7890" value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cu-addr">Alamat</Label><Textarea id="cu-addr" rows={2} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cu-note">Catatan</Label><input id="cu-note" className={field} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
            </fieldset>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="h-11" disabled={saving} onClick={() => setEditing(null)}>Batal</Button>
              <Button type="submit" className="h-11 flex-1" disabled={saving}>{saving ? "Menyimpan…" : "Simpan pelanggan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
