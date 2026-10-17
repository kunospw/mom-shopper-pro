import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, ImagePlus, Images, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput, field, parseRupiah } from "@/components/form-parts";
import { catalogPhoto } from "@/lib/catalog-image";
import { emptyProduct, type CatalogProduct, type CatalogProductFields } from "@/lib/catalog";
import { MAX_IMPORT_ROWS, rowFromPhoto, rowsFromTable, templateCsv, validate, type ImportRow } from "@/lib/product-import";
import { cn } from "@/lib/utils";
import type { Inventory } from "@/types/books";

interface Draft {
  key: string;
  line: number;
  fields: CatalogProductFields;
  price: string;
  cost: string;
  stock: string;
  status: "idle" | "saving" | "failed";
  /** Problems found while reading the file; each clears when its field is edited. Warnings don't block saving. */
  issues: Issue[];
}
type IssueField = "availability" | "stock" | "options" | "cost" | "other";
interface Issue {
  field: IssueField;
  text: string;
  blocking: boolean;
}
/** Sorts importer messages by the field the owner can change in the list. */
function issuesFrom(errors: string[]): Issue[] {
  return errors
    .filter((e) => !/nama produk kosong|harga/i.test(e))
    .map((text) =>
      /^Status/.test(text)
        ? { field: "availability", text, blocking: true }
        : /^Stok/.test(text)
          ? { field: "stock", text, blocking: true }
          : /pilihan/i.test(text)
            ? { field: "options", text: `${text} Tambahkan pilihan lewat Edit setelah disimpan.`, blocking: false }
            : /^Modal/.test(text)
              ? { field: "cost", text: `${text} Disimpan tanpa modal.`, blocking: false }
              : { field: "other", text, blocking: true },
    );
}
const newKey = () => Math.random().toString(36).slice(2);
function fromImport(row: ImportRow): Draft {
  return {
    key: newKey(),
    line: row.line,
    fields: row.fields,
    price: row.fields.price ? String(row.fields.price) : "",
    cost: row.inventory?.cost ? String(row.inventory.cost) : "",
    stock: row.inventory?.stock != null ? String(row.inventory.stock) : "",
    status: "idle",
    issues: issuesFrom(row.errors),
  };
}
/** Blocking problems; warnings are listed separately and don't stop saving. */
function problems(d: Draft): string[] {
  const fields = { ...d.fields, price: parseRupiah(d.price) };
  const own = validate(fields).map((e) => (/harga|nol/i.test(e) ? "Isi harga." : e));
  if (d.stock.trim() && !Number.isInteger(Number(d.stock))) own.push("Stok harus angka.");
  return [...new Set([...d.issues.filter((i) => i.blocking).map((i) => i.text), ...own])];
}
function summary(f: CatalogProductFields) {
  return [
    f.options.length ? `${f.options.length} ${f.optionLabel.toLowerCase()}` : "",
    f.availability === "preorder" ? `PO ${f.leadTime}` : f.availability === "unavailable" ? "Belum tersedia" : "",
    f.kind === "digital" ? "Digital" : "",
    f.description ? "ada deskripsi" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Adds many products at once: from a batch of photos (one product per photo)
 * or from a CSV / spreadsheet paste. Everything lands in an editable review
 * list first; complete rows are saved, incomplete ones stay to be fixed.
 */
export function BulkAddProducts({
  categories,
  onSave,
  onDone,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  categories: string[];
  onSave: (fields: CatalogProductFields, inventory: Inventory | null) => Promise<CatalogProduct>;
  onDone: (saved: number) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [rows, setRows] = useState<Draft[]>([]);
  const [publish, setPublish] = useState(true);
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const photosInput = useRef<HTMLInputElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const rowPhoto = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const busy = !!progress;
  const checked = useMemo(() => rows.map((r) => ({ row: r, errors: problems(r) })), [rows]);
  const ready = checked.filter((c) => c.errors.length === 0);
  const room = MAX_IMPORT_ROWS - rows.length;

  function add(next: Draft[]) {
    setRows((prev) => [...prev, ...next]);
    if (next.length) onDirtyChange(true);
  }
  function edit(key: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>), field?: IssueField) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, ...(typeof patch === "function" ? patch(r) : patch), status: "idle", issues: field ? r.issues.filter((i) => i.field !== field) : r.issues }
          : r,
      ),
    );
    onDirtyChange(true);
  }
  function editFields(key: string, patch: Partial<CatalogProductFields>, field?: IssueField) {
    edit(key, (d) => ({ fields: { ...d.fields, ...patch } }), field);
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    const take = files.slice(0, room);
    setNotice(files.length > room ? { tone: "info", text: `Maksimal ${MAX_IMPORT_ROWS} produk sekali tambah; ${files.length - room} foto dilewati.` } : null);
    onBusyChange(true);
    const made: Draft[] = [];
    const failed: string[] = [];
    for (let i = 0; i < take.length; i++) {
      setProgress({ label: "Menyiapkan foto", done: i, total: take.length });
      const draft = fromImport(rowFromPhoto(take[i].name, rows.length + i + 1));
      try {
        draft.fields = { ...draft.fields, image: await catalogPhoto(take[i]) };
        made.push(draft);
      } catch {
        failed.push(take[i].name);
      }
    }
    setProgress(null);
    onBusyChange(false);
    add(made);
    if (failed.length) setNotice({ tone: "error", text: `${failed.length} foto tidak bisa dibaca: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}` });
  }

  function addTable(text: string) {
    // Parsed as visible; only an explicit "Tampil: tidak" keeps a row hidden. The switch applies at save.
    const result = rowsFromTable(text);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return false;
    }
    const take = result.rows.slice(0, room);
    const skipped = result.skipped + result.rows.length - take.length;
    add(take.map(fromImport));
    setNotice(skipped ? { tone: "info", text: `Maksimal ${MAX_IMPORT_ROWS} produk sekali tambah; ${skipped} baris dilewati.` } : null);
    return true;
  }
  async function readSheet(file?: File) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setNotice({ tone: "error", text: "File Excel (.xlsx) belum bisa dibaca langsung. Di Excel pilih File → Simpan sebagai → CSV, atau salin barisnya lalu tempel di bawah." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ tone: "error", text: "File terlalu besar. Maksimal 2 MB." });
      return;
    }
    addTable(await file.text());
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-produk.csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveAll() {
    const queue = ready.map((c) => c.row);
    if (!queue.length || busy) return;
    onBusyChange(true);
    let saved = 0;
    const left = new Set(rows.map((r) => r.key));
    for (let i = 0; i < queue.length; i++) {
      const d = queue[i];
      setProgress({ label: "Menyimpan produk", done: i, total: queue.length });
      setRows((prev) => prev.map((r) => (r.key === d.key ? { ...r, status: "saving" } : r)));
      const stock = d.stock.trim() ? Math.round(Number(d.stock)) : null;
      const cost = parseRupiah(d.cost);
      try {
        await onSave({ ...d.fields, price: parseRupiah(d.price), published: publish && d.fields.published }, cost || stock !== null ? { cost, stock } : null);
        saved++;
        left.delete(d.key);
        setRows((prev) => prev.filter((r) => r.key !== d.key));
      } catch {
        setRows((prev) => prev.map((r) => (r.key === d.key ? { ...r, status: "failed" } : r)));
      }
    }
    setProgress(null);
    onBusyChange(false);
    setSavedCount((n) => n + saved);
    if (left.size === 0) {
      onDirtyChange(false);
      onDone(savedCount + saved);
    } else {
      setNotice({
        tone: saved ? "info" : "error",
        text: `${saved} produk tersimpan. ${left.size} baris masih perlu diperbaiki atau disimpan ulang.`,
      });
    }
  }

  const hidden = (
    <>
      <input ref={photosInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Pilih foto produk" onChange={(e) => { void addPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <input ref={sheetInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,.xlsx,.xls" className="sr-only" tabIndex={-1} aria-label="Pilih file CSV" onChange={(e) => { void readSheet(e.target.files?.[0]); e.target.value = ""; }} />
      <input
        ref={rowPhoto}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Foto untuk baris produk"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !photoFor) return;
          try {
            const image = await catalogPhoto(file);
            editFields(photoFor, { image });
          } catch (failure) {
            setNotice({ tone: "error", text: failure instanceof Error ? failure.message : "Foto tidak dapat dibaca." });
          }
        }}
      />
    </>
  );
  const status = notice && (
    <p role={notice.tone === "error" ? "alert" : "status"} className={cn("flex gap-2 rounded-xl p-3 text-sm", notice.tone === "error" ? "bg-destructive-soft text-destructive" : "bg-info-soft text-info")}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {notice.text}
    </p>
  );
  const progressBar = progress && (
    <div role="status" className="space-y-1.5 rounded-xl bg-card p-3 shadow-card">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {progress.label} {progress.done + 1} dari {progress.total}…
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((progress.done + 1) / progress.total) * 100}%` }} />
      </div>
    </div>
  );

  if (rows.length === 0)
    return (
      <div className="space-y-4">
        {hidden}
        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="bulk-photos" className="flex flex-col rounded-2xl bg-card p-5 shadow-card sm:p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary">
              <Images className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 id="bulk-photos" className="mt-3 text-base font-semibold">Dari foto</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Pilih banyak foto sekaligus dari galeri. Setiap foto jadi satu produk dan dipotong persegi otomatis; tinggal isi nama dan harga.
            </p>
            <Button className="mt-4 h-11 rounded-[10px]" disabled={busy} onClick={() => photosInput.current?.click()}>
              <ImagePlus /> Pilih foto
            </Button>
          </section>
          <section aria-labelledby="bulk-sheet" className="flex flex-col rounded-2xl bg-card p-5 shadow-card sm:p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft text-info">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 id="bulk-sheet" className="mt-3 text-base font-semibold">Dari Excel atau Google Sheets</h3>
            <p className="mt-1 text-sm text-muted-foreground">Isi template (nama, harga, kategori, status, pilihan, modal, stok), lalu unggah CSV-nya atau salin barisnya ke sini.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download /> Unduh template
              </Button>
              <Button variant="outline" onClick={() => sheetInput.current?.click()}>
                <FileSpreadsheet /> Unggah CSV
              </Button>
            </div>
            <Label htmlFor="bulk-paste" className="mt-4">Atau tempel dari spreadsheet</Label>
            <Textarea
              id="bulk-paste"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Nama\tHarga\tKategori\nGamis Katun\t189000\tPakaian"}
              className="mt-1.5 font-mono text-xs"
            />
            <Button variant="secondary" className="mt-2 self-start" disabled={!paste.trim()} onClick={() => addTable(paste) && setPaste("")}>
              <ClipboardPaste /> Baca tempelan
            </Button>
          </section>
        </div>
        {progressBar}
        {status}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="min-w-0">
            <Label htmlFor="bulk-publish">Tampilkan langsung di katalog</Label>
            <p className="text-xs text-muted-foreground">Matikan jika ingin memeriksanya dulu sebelum pembeli melihat.</p>
          </div>
          <Switch id="bulk-publish" checked={publish} onCheckedChange={setPublish} />
        </div>
        <Button variant="ghost" onClick={onCancel}>Batal</Button>
      </div>
    );

  return (
    <div className="space-y-4">
      {hidden}
      <datalist id="bulk-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" role="status">
          <strong>{rows.length} produk</strong>
          {checked.length - ready.length > 0 ? (
            <span className="text-request"> · {checked.length - ready.length} perlu dilengkapi</span>
          ) : (
            <span className="text-success"> · semua lengkap</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy || room <= 0} onClick={() => photosInput.current?.click()}>
            <ImagePlus /> Tambah foto
          </Button>
          <Button variant="outline" size="sm" disabled={busy || room <= 0} onClick={() => add([fromImport({ line: rows.length + 1, fields: { ...emptyProduct, published: true }, inventory: null, errors: [] })])}>
            <Plus /> Tambah baris
          </Button>
        </div>
      </div>
      {status}
      <ul aria-label="Produk yang akan ditambahkan" className="space-y-3">
        {checked.map(({ row: d, errors }, index) => {
          const meta = summary(d.fields);
          return (
            <li key={d.key} className={cn("rounded-2xl border bg-card p-3 shadow-card sm:p-4", errors.length && "border-request/50", d.status === "failed" && "border-destructive")}>
              <div className="grid grid-cols-[56px_minmax(0,1fr)_40px] items-start gap-x-3 gap-y-2 sm:grid-cols-[80px_minmax(0,1fr)_40px]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPhotoFor(d.key);
                    rowPhoto.current?.click();
                  }}
                  className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:row-span-2 sm:h-20 sm:w-20"
                  aria-label={`${d.fields.image ? "Ganti" : "Tambah"} foto produk ${index + 1}`}
                >
                  {d.fields.image ? <img src={d.fields.image} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                </button>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`bulk-name-${d.key}`} className="text-xs">Nama produk {index + 1}</Label>
                  <input id={`bulk-name-${d.key}`} className={cn(field, "h-10")} maxLength={80} value={d.fields.name} placeholder="Nama produk" onChange={(e) => editFields(d.key, { name: e.target.value })} />
                </div>
                <Button variant="ghost" size="icon" className="mt-5 h-10 w-10 text-muted-foreground hover:text-destructive" disabled={busy} aria-label={`Hapus baris ${index + 1}`} onClick={() => { setRows((prev) => prev.filter((r) => r.key !== d.key)); onDirtyChange(true); }}>
                  <Trash2 />
                </Button>
                <div className="col-span-3 grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:col-start-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_80px_130px]">
                  <div className="space-y-1">
                    <Label htmlFor={`bulk-price-${d.key}`} className="text-xs">Harga</Label>
                    <MoneyInput id={`bulk-price-${d.key}`} className="h-10" value={d.price} onChange={(v) => edit(d.key, { price: v })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`bulk-cat-${d.key}`} className="text-xs">Kategori</Label>
                    <input id={`bulk-cat-${d.key}`} className={cn(field, "h-10")} list="bulk-categories" maxLength={40} value={d.fields.category} onChange={(e) => editFields(d.key, { category: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`bulk-stock-${d.key}`} className="text-xs">Stok</Label>
                    <input id={`bulk-stock-${d.key}`} className={cn(field, "num h-10")} inputMode="numeric" placeholder="—" value={d.stock} onChange={(e) => edit(d.key, { stock: e.target.value.replace(/[^\d-]/g, "") }, "stock")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`bulk-status-${d.key}`} className="text-xs">Status</Label>
                    <select
                      id={`bulk-status-${d.key}`}
                      className={cn(field, "h-10 px-2", d.issues.some((i) => i.field === "availability") && "border-request")}
                      value={d.fields.availability}
                      onChange={(e) => {
                        const availability = e.target.value as CatalogProductFields["availability"];
                        editFields(d.key, { availability, leadTime: availability === "preorder" ? d.fields.leadTime || "7 hari" : "" }, "availability");
                      }}
                    >
                      <option value="ready">Ready</option>
                      <option value="preorder">PO</option>
                      <option value="unavailable">Belum tersedia</option>
                    </select>
                  </div>
                </div>
              </div>
              {(meta || errors.length > 0 || d.issues.length > 0 || d.status !== "idle" || !d.fields.image) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:pl-[92px]">
                  {d.status === "saving" && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Menyimpan…</span>}
                  {d.status === "failed" && <span className="font-semibold text-destructive">Belum tersimpan. Coba lagi.</span>}
                  {errors.map((e) => (
                    <span key={e} className="font-medium text-request">{e}</span>
                  ))}
                  {d.issues.filter((i) => !i.blocking).map((i) => (
                    <span key={i.text} className="text-muted-foreground">{i.text}</span>
                  ))}
                  {meta && <span className="text-muted-foreground">{meta}</span>}
                  {!d.fields.image && !errors.length && <span className="text-muted-foreground">Tanpa foto</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {progressBar}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 sm:-mx-7 sm:px-7">
        <label className="mr-auto flex items-center gap-2 text-sm">
          <Switch checked={publish} onCheckedChange={setPublish} aria-label="Tampilkan langsung di katalog" />
          Tampilkan di katalog
        </label>
        <Button variant="outline" className="h-11 rounded-[10px]" disabled={busy} onClick={onCancel}>Batal</Button>
        <Button className="h-11 rounded-[10px]" disabled={busy || ready.length === 0} onClick={() => void saveAll()}>
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {ready.length === rows.length ? `Simpan ${ready.length} produk` : `Simpan ${ready.length} yang lengkap`}
        </Button>
      </div>
      {savedCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {savedCount} produk sudah masuk katalog.
        </p>
      )}
    </div>
  );
}
