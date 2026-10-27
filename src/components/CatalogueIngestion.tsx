import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { catalogueRequest, uploadCatalogue, type ReviewJob } from "@/lib/catalogue-client";
import { missing, type Candidate, type Draft } from "@/lib/catalogue-ingestion";

export function CatalogueIngestion({ uid, onSaved, onDirtyChange, onBusyChange }: {
  uid: string; onSaved(): void; onDirtyChange(value: boolean): void; onBusyChange(value: boolean): void;
}) {
  const key = `larisku-catalogue-job:${uid}`;
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<{ id: string; status: string }[]>([]);
  const [next, setNext] = useState<string | null>(null);
  async function loadHistory(after?: string) {
    const result = await catalogueRequest<{ jobs: typeof history; next: string | null }>({ action: "list", ...(after ? { after } : {}) });
    setHistory(rows => after ? [...rows, ...result.jobs] : result.jobs); setNext(result.next);
  }
  function accept(next: ReviewJob) {
    localStorage.setItem(key, next.id);
    setJob(next); setDrafts(next.drafts); setDirty(false); onDirtyChange(false); setChecked(false);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); onBusyChange(true); setError(""); setSlow(false);
    const timer = setTimeout(() => setSlow(true), 5000);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Belum berhasil. Coba lagi."); }
    finally { clearTimeout(timer); setBusy(false); onBusyChange(false); }
  }
  useEffect(() => {
    const id = localStorage.getItem(key);
    void run(async () => { await loadHistory(); if (id) accept(await catalogueRequest({ action: "status", jobId: id })); });
    // One resume per seller; processing can also be refreshed manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  function change(id: string, field: keyof Candidate, value: string) {
    setDrafts(rows => rows.map(d => d.id === id ? { ...d, candidate: { ...d.candidate, [field]: field === "price" ? (value === "" ? null : Number(value)) : (value || null) } } : d));
    setChecked(false); setDirty(true); onDirtyChange(true);
  }
  const incomplete = drafts.some(d => missing(d.candidate).length > 0);
  return <section className="space-y-4" aria-label="Impor katalog AI">
    <p>Unggah katalog untuk membuat draf pribadi. Periksa semua hasil AI sebelum menyimpan. Produk baru disimpan tersembunyi; tampilkan kemudian dari editor produk.</p>
    <p className="text-sm text-muted-foreground">PDF 1 halaman atau JPEG/PNG · maksimal 2 MiB, 16 MP, 15 produk. Berkas dikirim ke Google Vision dan teks ke penyedia AI. Berkas asli tidak disimpan. SKU dan tautan gambar hanya menjadi catatan draf.</p>
    <Button variant="outline" disabled={busy} onClick={() => void run(() => loadHistory())}>Muat riwayat impor</Button>
    {history.length > 0 && <label className="block">Lanjutkan impor sebelumnya<select className="block w-full rounded border bg-background p-2" value={history.some(h => h.id === job?.id) ? job?.id : ""} disabled={busy || dirty} onChange={e => { const id = e.target.value; if (id) void run(async () => accept(await catalogueRequest({ action: "status", jobId: id }))); }}><option value="">Pilih impor</option>{history.map(h => <option key={h.id} value={h.id}>{h.id.slice(0, 12)} · {h.status}</option>)}</select></label>}
    {next && <Button variant="outline" disabled={busy} onClick={() => void run(() => loadHistory(next))}>Riwayat berikutnya</Button>}
    <label className="block">Berkas katalog<input className="block w-full" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setProgress(0); }} /></label>
    <Button disabled={busy || !file || dirty} onClick={() => void run(async () => { setProgress(0); accept(await uploadCatalogue(file!, setProgress)); })}>Unggah dan buat draf</Button>
    {busy && <div role="status"><progress className="w-full" max={100} value={progress} aria-label="Progres unggah" /><p>{progress < 100 ? `Mengunggah ${progress}%` : "Membaca katalog dan menyiapkan draf…"}</p>{slow && <p>Masih diproses. Target 5 detik terlewati; proses dibatasi 35 detik. Jangan unggah ulang dahulu.</p>}</div>}
    {error && <p role="alert">{error}</p>}
    {job && <p role="status">Status: {job.status}{job.elapsedMs != null ? ` · ${(job.elapsedMs / 1000).toFixed(1)} detik` : ""}{job.error ? ` · ${job.error}` : ""}</p>}
    {job && job.status !== "review" && <Button variant="outline" disabled={busy} onClick={() => void run(async () => accept(await catalogueRequest({ action: "status", jobId: job.id })))}>Periksa status</Button>}
    {job?.status === "failed" && <p>Ekstraksi gagal; produk tidak dibuat. Pilih berkas yang sama dan unggah lagi untuk mencoba ulang (maksimal 3 percobaan).</p>}
    {job?.status === "confirmed" && <p>Konfirmasi sudah tersimpan. Mengulangi permintaan tidak membuat produk ganda.</p>}
    {job?.status === "review" && <>
      <p className="font-semibold">Hasil belum pasti — cocokkan setiap produk dengan katalog asli.</p>
      {drafts.map((draft, i) => <fieldset key={draft.id} className="space-y-2 rounded-xl border p-3" disabled={busy}>
        <legend>Produk {i + 1}</legend>
        {([ ["name", "Nama produk", 80], ["price", "Harga Rupiah", undefined], ["sku", "SKU (catatan)", 80], ["description", "Deskripsi", 1500], ["imageUrl", "Tautan gambar (catatan)", 2000] ] as const).map(([field, label, max]) => <div key={field} className="text-sm">
          <label htmlFor={`draft-${draft.id}-${field}`}>{label}</label>
          <input id={`draft-${draft.id}-${field}`} aria-describedby={draft.candidate[field] == null ? `draft-${draft.id}-${field}-help` : undefined} className="block w-full rounded border bg-background p-2" type={field === "price" ? "number" : "text"} min={field === "price" ? 1 : undefined} step={field === "price" ? 1 : undefined} maxLength={max} value={draft.candidate[field] ?? ""} onChange={e => change(draft.id, field, e.target.value)} />
          {draft.candidate[field] == null && <span id={`draft-${draft.id}-${field}-help`} className="text-muted-foreground">Tidak ditemukan — {field === "name" || field === "price" ? "wajib dilengkapi" : "opsional"}</span>}
        </div>)}
        {missing(draft.candidate).length > 0 && <p role="alert">{missing(draft.candidate).join("; ")}</p>}
      </fieldset>)}
      <Button variant="outline" disabled={busy || !dirty} onClick={() => void run(async () => accept(await catalogueRequest({ action: "save", jobId: job.id, drafts })))}>Simpan koreksi draf</Button>
      <label className="flex gap-2"><input type="checkbox" disabled={busy || dirty || incomplete} checked={checked} onChange={e => setChecked(e.target.checked)} />Saya sudah memeriksa semua produk, harga, dan informasi yang kosong.</label>
      <Button disabled={busy || dirty || incomplete || !checked} onClick={() => void run(async () => { accept(await catalogueRequest({ action: "confirm", jobId: job.id, revision: job.revision, confirmed: true })); onSaved(); })}>Konfirmasi dan simpan semua produk</Button>
    </>}
  </section>;
}
