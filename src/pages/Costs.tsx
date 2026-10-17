import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Megaphone, Package, Plus, Receipt, Trash2, Truck, type LucideIcon, Box, CreditCard, MoreHorizontal } from "lucide-react";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import type { CatalogProduct } from "@/lib/catalog";
import { useBooks } from "@/contexts/BooksContext";
import { deleteExpense, deletePurchase, newId, saveExpense, savePurchase } from "@/lib/books-storage";
import { purchaseTotals } from "@/lib/books";
import type { Expense, ExpenseCategory, Purchase } from "@/types/books";
import { formatRupiah } from "@/lib/currency";
import { buildReport } from "@/lib/report";
import { inRange, localDateToISO, localToday, monthKey, periodRange } from "@/lib/period";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterChips, MoneyInput, SearchBox, Section, StatCard, field, parseRupiah } from "@/components/form-parts";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const categories: Record<ExpenseCategory, { label: string; Icon: LucideIcon }> = {
  ongkir: { label: "Ongkir", Icon: Truck },
  packaging: { label: "Kemasan", Icon: Box },
  iklan: { label: "Iklan", Icon: Megaphone },
  admin: { label: "Biaya admin", Icon: CreditCard },
  lainnya: { label: "Lainnya", Icon: MoreHorizontal },
};
const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateLabel = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

type Row =
  | { type: "purchase"; id: string; date: string; amount: number; title: string; detail: string; record: Purchase }
  | { type: "expense"; id: string; date: string; amount: number; title: string; detail: string; record: Expense };

type Line = { key: string; productId: string; name: string; qty: string; cost: string };
const blankLine = (): Line => ({ key: Math.random().toString(36).slice(2), productId: "", name: "", qty: "1", cost: "" });

function PurchaseForm({
  purchase,
  catalog,
  onDone,
  onCancel,
  onDirtyChange,
}: {
  purchase?: Purchase;
  catalog: CatalogProduct[];
  onDone: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const books = useBooks();
  const [supplier, setSupplier] = useState(purchase?.supplier ?? "");
  const [date, setDate] = useState(purchase ? toDateInput(purchase.date) : localToday());
  const [shipping, setShipping] = useState(purchase?.shipping ? String(purchase.shipping) : "");
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    purchase?.items.length
      ? purchase.items.map((i) => ({ key: Math.random().toString(36).slice(2), productId: i.productId ?? "", name: i.name, qty: String(i.quantity), cost: String(i.unitCost) }))
      : [blankLine()],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const tracked = catalog.filter((p) => books.inventory[p.id]?.stock != null);
  const suppliers = useMemo(() => [...new Set(books.purchases.map((p) => p.supplier.trim()).filter(Boolean))], [books.purchases]);
  const dirty = () => onDirtyChange(true);
  function edit(key: string, patch: Partial<Line>) {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setError("");
    dirty();
  }
  const goods = lines.reduce((s, l) => s + Math.max(0, Math.round(Number(l.qty)) || 0) * parseRupiah(l.cost), 0);
  const total = goods + parseRupiah(shipping);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const items = lines
      .filter((l) => l.name.trim() || l.cost)
      .map((l) => ({ ...(l.productId ? { productId: l.productId } : {}), name: l.name.trim(), quantity: Math.round(Number(l.qty)) || 0, unitCost: parseRupiah(l.cost) }));
    if (!items.length || items.some((i) => !i.name || i.quantity < 1 || i.unitCost <= 0))
      return setError("Isi nama barang, jumlah, dan harga beli lebih dari nol untuk setiap baris.");
    if (!date) return setError("Isi tanggal pembelian.");
    setSaving(true);
    try {
      const next: Purchase = {
        id: purchase?.id ?? newId("purchases"),
        date: localDateToISO(date),
        supplier: supplier.trim(),
        items,
        shipping: parseRupiah(shipping),
        total: items.reduce((s, i) => s + i.quantity * i.unitCost, 0) + parseRupiah(shipping),
        notes: notes.trim(),
        ...(purchase?.legacyId ? { legacyId: purchase.legacyId } : {}),
      };
      await savePurchase(next, purchase);
      await books.reload();
      flushSync(() => onDirtyChange(false));
      toast.success(purchase ? "Pembelian diperbarui" : "Pembelian tersimpan");
      onDone();
    } catch {
      setError("Pembelian belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <Section step={1} title="Barang yang dibeli" hint={`${lines.length} baris`}>
          <ul className="space-y-3">
            {lines.map((line, index) => (
              <li key={line.key} className="rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor={`pu-name-${index}`}>Nama barang{lines.length > 1 ? ` ${index + 1}` : ""}</Label>
                    <input id={`pu-name-${index}`} className={field} value={line.name} placeholder="Contoh: Gamis Katun Rayon" list="pu-products" onChange={(e) => {
                      const match = tracked.find((p) => p.name === e.target.value);
                      edit(line.key, { name: e.target.value, ...(match && !line.productId ? { productId: match.id } : {}) });
                    }} />
                  </div>
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="mt-6 h-11 w-11 shrink-0" aria-label={`Hapus barang ${index + 1}`} onClick={() => { setLines((rows) => rows.filter((r) => r.key !== line.key)); dirty(); }}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`pu-qty-${index}`}>Jumlah</Label>
                    <input id={`pu-qty-${index}`} className={cn(field, "num")} type="number" inputMode="numeric" min={1} value={line.qty} onChange={(e) => edit(line.key, { qty: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pu-cost-${index}`}>Harga beli satuan</Label>
                    <MoneyInput id={`pu-cost-${index}`} value={line.cost} onChange={(v) => edit(line.key, { cost: v })} />
                  </div>
                </div>
                {tracked.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <Label htmlFor={`pu-product-${index}`}>Tambah ke stok produk</Label>
                    <select id={`pu-product-${index}`} className={field} value={line.productId} onChange={(e) => edit(line.key, { productId: e.target.value })}>
                      <option value="">Tidak dikaitkan</option>
                      {tracked.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (stok {books.inventory[p.id]?.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <datalist id="pu-products">
            {catalog.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <Button type="button" variant="outline" className="mt-3" onClick={() => { setLines((rows) => [...rows, blankLine()]); dirty(); }}>
            <Plus /> Tambah barang
          </Button>
        </Section>

        <Section step={2} title="Detail pembelian">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pu-ship">Ongkir pembelian</Label>
              <MoneyInput id="pu-ship" value={shipping} onChange={(v) => { setShipping(v); dirty(); }} describedBy="pu-ship-hint" />
              <p id="pu-ship-hint" className="text-xs text-muted-foreground">Dihitung sebagai biaya pada tanggal pembelian.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu-date">Tanggal</Label>
              <input id="pu-date" type="date" className={field} value={date} onChange={(e) => { setDate(e.target.value); dirty(); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu-sup">
                Pemasok <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <input id="pu-sup" className={field} list="pu-suppliers" value={supplier} onChange={(e) => { setSupplier(e.target.value); dirty(); }} />
              <datalist id="pu-suppliers">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu-notes">
                Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <input id="pu-notes" className={field} value={notes} maxLength={300} onChange={(e) => { setNotes(e.target.value); dirty(); }} />
            </div>
          </div>
        </Section>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 space-y-3 border-t bg-card px-4 py-3 sm:-mx-7 sm:px-7">
        <dl className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <div className="flex gap-2"><dt className="text-muted-foreground">Barang</dt><dd className="num font-medium">{formatRupiah(goods)}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground">Ongkir</dt><dd className="num font-medium">{formatRupiah(parseRupiah(shipping))}</dd></div>
          <div className="flex gap-2"><dt className="font-semibold">Total</dt><dd className="num font-bold">{formatRupiah(total)}</dd></div>
        </dl>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-[10px]" disabled={saving} onClick={onCancel}>Batal</Button>
          <Button type="submit" className="h-11 flex-1 rounded-[10px]" disabled={saving}>{saving ? "Menyimpan…" : "Simpan pembelian"}</Button>
        </div>
      </div>
    </form>
  );
}

function ExpenseForm({ expense, onDone, onCancel, onDirtyChange }: { expense?: Expense; onDone: () => void; onCancel: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const books = useBooks();
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "ongkir");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [date, setDate] = useState(expense ? toDateInput(expense.date) : localToday());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (parseRupiah(amount) <= 0) return setError("Isi jumlah biaya lebih dari nol.");
    if (!date) return setError("Isi tanggal biaya.");
    setSaving(true);
    try {
      await saveExpense({ id: expense?.id ?? newId("expenses"), date: localDateToISO(date), category, amount: parseRupiah(amount), note: note.trim() });
      await books.reload();
      flushSync(() => onDirtyChange(false));
      toast.success(expense ? "Biaya diperbarui" : "Biaya tersimpan");
      onDone();
    } catch {
      setError("Biaya belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={saving} className="min-w-0">
        <Section title="Biaya usaha">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-medium">Jenis biaya</legend>
            <div role="radiogroup" aria-label="Jenis biaya" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(categories) as ExpenseCategory[]).map((key) => {
                const { label, Icon } = categories[key];
                const on = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { setCategory(key); onDirtyChange(true); }}
                    className={cn(
                      "flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      on ? "border-primary bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ex-amt">Jumlah biaya</Label>
              <MoneyInput id="ex-amt" value={amount} onChange={(v) => { setAmount(v); setError(""); onDirtyChange(true); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ex-date">Tanggal</Label>
              <input id="ex-date" type="date" className={field} value={date} onChange={(e) => { setDate(e.target.value); onDirtyChange(true); }} />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Label htmlFor="ex-note">
              Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <input id="ex-note" className={field} maxLength={200} placeholder="Contoh: Iklan Instagram minggu ini" value={note} onChange={(e) => { setNote(e.target.value); onDirtyChange(true); }} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Biaya usaha mengurangi keuntungan bersih pada bulan tanggalnya. Modal barang dicatat di Pembelian stok.</p>
        </Section>
      </fieldset>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 rounded-[10px]" disabled={saving} onClick={onCancel}>Batal</Button>
        <Button type="submit" className="h-11 flex-1 rounded-[10px]" disabled={saving}>{saving ? "Menyimpan…" : "Simpan biaya"}</Button>
      </div>
    </form>
  );
}

export default function Costs() {
  const books = useBooks();
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [dirty, setDirty] = useState(false);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    getOwnerCatalog().then((c) => setCatalog(c.products)).catch(() => setCatalog([]));
  }, []);

  const creating = params.get("new");
  const editId = params.get("edit");
  const editingPurchase = editId ? books.purchases.find((p) => p.id === editId) : undefined;
  const editingExpense = editId ? books.expenses.find((e) => e.id === editId) : undefined;
  const formType: "purchase" | "expense" | null =
    creating === "purchase" || editingPurchase ? "purchase" : creating === "expense" || editingExpense ? "expense" : null;
  const blocker = useUnsavedChanges(!!formType && dirty);
  useEffect(() => {
    if (!formType) setDirty(false);
  }, [formType]);

  const filter = params.get("f") ?? "all";
  const q = params.get("q") ?? "";
  const month = params.get("m") ?? "";
  function setQuery(patch: Record<string, string | null>, replace = true) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  }
  const close = () => setQuery({ new: null, edit: null }, false);

  const rows = useMemo<Row[]>(() => {
    const purchases: Row[] = books.purchases.map((p) => ({
      type: "purchase",
      id: p.id,
      date: p.date,
      amount: purchaseTotals(p).total,
      title: p.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "Pembelian",
      detail: [p.supplier, p.shipping ? `ongkir ${formatRupiah(p.shipping)}` : ""].filter(Boolean).join(" · "),
      record: p,
    }));
    const expenses: Row[] = books.expenses.map((e) => ({
      type: "expense",
      id: e.id,
      date: e.date,
      amount: e.amount,
      title: categories[e.category]?.label ?? "Biaya",
      detail: e.note,
      record: e,
    }));
    return [...purchases, ...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [books.purchases, books.expenses]);
  const months = [...new Set(rows.map((r) => monthKey(r.date)))].sort().reverse();
  const inMonth = month ? rows.filter((r) => monthKey(r.date) === month) : rows;
  const term = q.trim().toLowerCase();
  const shown = inMonth.filter((r) => (filter === "all" || r.type === filter) && (!term || `${r.title} ${r.detail}`.toLowerCase().includes(term)));

  const ledger = { sales: books.sales, purchases: books.purchases, expenses: books.expenses };
  const range = month ? (() => { const [y, m] = month.split("-").map(Number); return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }; })() : periodRange("this-month");
  const report = buildReport(ledger, range);
  const periodName = month ? monthLabel(month) : "bulan ini";
  const byCategory = (Object.keys(categories) as ExpenseCategory[])
    .map((key) => ({ key, amount: books.expenses.filter((e) => e.category === key && inRange(e.date, range)).reduce((s, e) => s + e.amount, 0) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const categoryTotal = byCategory.reduce((s, c) => s + c.amount, 0);

  async function confirmDelete() {
    if (!removing) return;
    setDeleting(true);
    try {
      if (removing.type === "purchase") await deletePurchase(removing.record);
      else await deleteExpense(removing.id);
      await books.reload();
      toast.success(`${removing.type === "purchase" ? "Pembelian" : "Biaya"} dihapus`);
      setRemoving(null);
    } catch {
      toast.error("Belum terhapus. Coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Pembelian & biaya</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catat belanja stok dan biaya usaha supaya keuntungan bersih akurat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-[10px]" onClick={() => setQuery({ new: "expense", edit: null }, false)}>
            <Receipt /> Catat biaya
          </Button>
          <Button className="h-11 rounded-[10px]" onClick={() => setQuery({ new: "purchase", edit: null }, false)}>
            <Plus /> Catat pembelian
          </Button>
        </div>
      </header>

      {books.loading ? (
        <div role="status" aria-label="Memuat" className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-60" />
        </div>
      ) : books.error ? (
        <Card className="space-y-3 p-6">
          <p role="alert">Data belum dapat dimuat. Periksa koneksi Anda.</p>
          <Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button>
        </Card>
      ) : (
        <>
          <section aria-label={`Ringkasan ${periodName}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={`Belanja stok ${periodName}`} value={formatRupiah(report.purchaseGoods)} hint="Jadi modal saat barang terjual" />
            <StatCard label="Ongkir pembelian" value={formatRupiah(report.purchaseShipping)} />
            <StatCard label="Biaya usaha" value={formatRupiah(report.expenses)} />
            <StatCard label="Total uang keluar" value={formatRupiah(report.purchaseSpend + report.expenses)} tone="text-request" />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <Card className="min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4 sm:p-[18px]">
                <FilterChips
                  label="Saring catatan"
                  value={filter}
                  onChange={(v) => setQuery({ f: v })}
                  options={[
                    { id: "all", label: "Semua", count: inMonth.length },
                    { id: "purchase", label: "Pembelian stok", count: inMonth.filter((r) => r.type === "purchase").length },
                    { id: "expense", label: "Biaya usaha", count: inMonth.filter((r) => r.type === "expense").length },
                  ]}
                />
                <SearchBox id="costs-q" label="Cari catatan" value={q} onChange={(v) => setQuery({ q: v })} placeholder="Barang, pemasok, catatan" />
                <label className="sr-only" htmlFor="costs-month">Bulan</label>
                <select id="costs-month" value={month} onChange={(e) => setQuery({ m: e.target.value })} className="h-10 rounded-[10px] border border-input bg-card px-3 text-sm">
                  <option value="">Semua bulan</option>
                  {months.map((key) => (
                    <option key={key} value={key}>{monthLabel(key)}</option>
                  ))}
                </select>
              </div>
              {shown.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border-t p-10 text-center text-sm text-muted-foreground">
                  <Package className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                  {rows.length === 0
                    ? "Belum ada catatan. Catat belanja stok atau biaya seperti ongkir, kemasan, dan iklan agar keuntungan bersih tidak terlalu tinggi."
                    : "Tidak ada catatan untuk saringan ini."}
                  {rows.length > 0 && (
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                      Tampilkan semua
                    </button>
                  )}
                </div>
              ) : (
                <ul aria-label="Catatan pembelian dan biaya" className="divide-y border-t">
                  {shown.map((row) => {
                    const Icon = row.type === "purchase" ? Package : categories[(row.record as Expense).category]?.Icon ?? Receipt;
                    return (
                      <li key={`${row.type}-${row.id}`} className="flex items-center gap-1 pr-2 hover:bg-accent/50">
                        <button type="button" onClick={() => setQuery({ edit: row.id, new: null }, false)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-[18px]">
                          <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", row.type === "purchase" ? "bg-info-soft text-info" : "bg-request-soft text-request")}>
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words font-semibold sm:line-clamp-1">{row.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {dateLabel(row.date)} · {row.type === "purchase" ? "Pembelian stok" : "Biaya usaha"}
                              {row.detail && ` · ${row.detail}`}
                            </span>
                          </span>
                          <span className="num shrink-0 font-bold">{formatRupiah(row.amount)}</span>
                        </button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Hapus ${row.type === "purchase" ? "pembelian" : "biaya"} ${row.title}`} onClick={() => setRemoving(row)}>
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {shown.length > 0 && (
                <p className="flex flex-wrap justify-between gap-2 border-t px-[18px] py-3 text-[13px] text-muted-foreground">
                  <span>Menampilkan {shown.length} catatan</span>
                  <span className="num">Total {formatRupiah(shown.reduce((s, r) => s + r.amount, 0))}</span>
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold">Biaya usaha {periodName}</h2>
              {byCategory.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada biaya usaha pada periode ini.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {byCategory.map((c) => {
                    const { label, Icon } = categories[c.key];
                    const share = Math.round((c.amount / categoryTotal) * 100);
                    return (
                      <li key={c.key}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{label}</span>
                          <span className="num font-semibold">{formatRupiah(c.amount)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label} ${share}% dari biaya usaha`}>
                          <div className="h-full rounded-full bg-request" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                Belanja stok tidak langsung mengurangi keuntungan. Modalnya dihitung saat barang terjual; ongkir pembelian dihitung sebagai biaya.
              </p>
            </Card>
          </div>
        </>
      )}

      <Sheet open={!!formType} onOpenChange={(open) => !open && close()}>
        <SheetContent side="right" closeLabel="Tutup formulir" className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[600px]">
          <SheetHeader className="sticky top-0 z-10 border-b bg-card px-5 py-4 pr-16 text-left sm:px-7">
            <SheetTitle className="text-xl">
              {formType === "purchase" ? (editingPurchase ? "Ubah pembelian stok" : "Catat pembelian stok") : editingExpense ? "Ubah biaya usaha" : "Catat biaya usaha"}
            </SheetTitle>
            <SheetDescription>
              {formType === "purchase" ? "Barang yang Anda beli untuk dijual lagi. Stok produk yang dikaitkan bertambah otomatis." : "Biaya di luar modal barang, seperti ongkir, kemasan, atau iklan."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 sm:p-7">
            {editId && !editingPurchase && !editingExpense ? (
              <p>Catatan tidak ditemukan.</p>
            ) : formType === "purchase" ? (
              <PurchaseForm key={editId ?? "new"} purchase={editingPurchase} catalog={catalog} onDone={close} onCancel={close} onDirtyChange={setDirty} />
            ) : formType === "expense" ? (
              <ExpenseForm key={editId ?? "new"} expense={editingExpense} onDone={close} onCancel={close} onDirtyChange={setDirty} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && !deleting && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {removing?.type === "purchase" ? "pembelian" : "biaya"} ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.title} · {removing ? formatRupiah(removing.amount) : ""}.{" "}
              {removing?.type === "purchase" ? "Stok produk yang dikaitkan ikut dikurangi kembali." : "Laporan keuntungan ikut diperbarui."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(e) => { e.preventDefault(); void confirmDelete(); }}>
              {deleting ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
