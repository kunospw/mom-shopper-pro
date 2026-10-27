import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, History, ImagePlus, Loader2, LockKeyhole, PackageCheck, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput, Section, field } from "@/components/form-parts";
import { candidateSchema, missing, type Candidate, type Draft } from "@/lib/catalogue-ingestion";
import type { ReviewJob } from "@/lib/catalogue-client";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = { processing: "Sedang dibaca", failed: "Belum berhasil", review: "Perlu diperiksa", confirmed: "Sudah disimpan" };
const messages: Record<string, string> = {
  "invalid-request": "Periksa isian draf, terutama harga dan tautan gambar.",
  "review-changed-reload": "Draf berubah di sesi lain. Tutup dan buka kembali untuk memuat versi terbaru.",
  "busy-try-later": "Masih ada katalog yang diproses. Tunggu sebentar, lalu coba lagi.",
  "daily-limit": "Batas impor hari ini sudah tercapai. Coba lagi besok.",
  "sign-in-required": "Sesi Anda berakhir. Masuk kembali untuk melanjutkan.",
};
interface Props {
  job: ReviewJob | null; drafts: Draft[]; file: File | null; busy: boolean; progress: number;
  error: string; activity: string; slow: boolean; dirty: boolean; checked: boolean; incomplete: boolean;
  history: { id: string; status: string }[]; next: string | null;
  onPick(file: File | null): void; onChange(id: string, field: keyof Candidate, value: string): void;
  onChecked(value: boolean): void; onUpload(): void; onSaveDraft(): void; onConfirm(): void;
  onResume(id: string): void; onHistory(after?: string): void; onAnother(): void; onDone(): void;
}
export function CatalogueIngestionView(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const sample = import.meta.env.VITE_FIREBASE_EMULATOR === "1" && import.meta.env.VITE_CATALOGUE_SAMPLE_IMAGE === "1";
  useEffect(() => {
    if (!p.file || !["image/jpeg", "image/png"].includes(p.file.type) || p.file.size > 2 * 1024 * 1024) { setPhoto(""); return; }
    const url = URL.createObjectURL(p.file); setPhoto(url);
    return () => URL.revokeObjectURL(url);
  }, [p.file]);
  const review = p.job?.status === "review";
  const confirmed = p.job?.status === "confirmed";
  const source = photo || (sample && review ? "/__preview/catalogue.jpg" : "");
  const step = confirmed ? 3 : review ? 2 : 1;
  const needs = p.drafts.filter(d => missing(d.candidate).length || !candidateSchema.safeParse(d.candidate).success).length;
  const friendlyError = messages[p.error] ?? (/^[a-z]+(?:-[a-z]+)+$/.test(p.error) ? "Belum berhasil. Draf tetap tersedia; silakan coba lagi." : p.error);
  return <section className="space-y-5" aria-label="Impor katalog AI">
    <ol aria-label="Langkah impor" className="flex items-center gap-2 text-xs sm:text-sm">
      {["Unggah katalog", "Periksa produk", "Simpan"].map((label, i) => <li key={label} className={cn("flex min-w-0 flex-1 items-center gap-2", step === i + 1 ? "font-semibold" : "text-muted-foreground")}><span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted")}>{step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}</span><span>{label}</span>{i < 2 && <span className="ml-auto h-px flex-1 bg-border max-sm:hidden" />}</li>)}
    </ol>
    {sample && <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">Contoh manual: 12 penawaran dari katalog PREMIUM APP sebelumnya. Bukan hasil OCR.</p>}
    {p.error && <div role="alert" className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0" /><p>{friendlyError}</p></div>}
    {p.busy && <div role="status" className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin" />{p.activity}</div>{p.activity === "Membaca katalog…" && <progress max={100} value={p.progress} aria-label="Progres unggah" className="mt-3 h-2 w-full accent-primary" />}{p.slow && <p className="mt-2 text-sm text-muted-foreground">Masih diproses. Anda tetap bisa menunggu di sini; proses dibatasi 35 detik.</p>}</div>}

    {!review && !confirmed && <>
      <Section step={1} title="Unggah katalog" hint="Foto atau PDF">
        <p className="mb-4 text-sm text-muted-foreground">Pilih daftar harga dari pemasok. Kami bantu menyiapkan draf; Anda memeriksa produknya sebelum disimpan.</p>
        <input ref={input} className="sr-only" tabIndex={-1} type="file" aria-label="Berkas katalog" accept="application/pdf,image/jpeg,image/png" disabled={p.busy} onChange={e => p.onPick(e.target.files?.[0] ?? null)} />
        <button type="button" disabled={p.busy} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (!p.busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!p.busy) p.onPick(e.dataTransfer.files[0] ?? null); }} className={cn("flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-background p-6 text-center transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60", dragging && "border-primary bg-primary-soft/40")}>
          {photo ? <img src={photo} alt="Katalog yang dipilih" className="h-28 max-w-full rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary"><UploadCloud className="h-7 w-7" /></span>}
          <span className="max-w-full break-all font-semibold">{p.file ? p.file.name : "Pilih foto atau PDF katalog"}</span><span className="text-xs text-muted-foreground">{p.file ? `${(p.file.size / 1024).toFixed(0)} KB · Klik untuk mengganti berkas` : "Klik untuk memilih atau seret berkas ke sini"}</span>
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">JPG, PNG, atau PDF 1 halaman · Maksimal 2 MB dan 15 produk</p>
        {sample && <Button className="mt-3 w-full" variant="ghost" disabled={p.busy} onClick={async () => { const response = await fetch("/__preview/catalogue.jpg"); if (response.ok) p.onPick(new File([await response.blob()], "Contoh katalog aplikasi.jpeg", { type: "image/jpeg" })); }}><ImagePlus className="h-4 w-4" />Gunakan contoh PREMIUM APP</Button>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Draf hanya untuk Anda</span><Button disabled={p.busy || !p.file} onClick={p.onUpload}>Buat draf produk<ArrowRight className="h-4 w-4" /></Button></div>
      </Section>
      {p.job?.status === "failed" && <div className="flex gap-3 rounded-xl border bg-card p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><h3 className="font-semibold">Katalog belum dapat dibaca</h3><p className="mt-1 text-sm text-muted-foreground">Produk belum dibuat. Coba foto yang lebih jelas atau pecah daftar yang berisi lebih dari 15 produk. Berkas yang sama bisa dicoba sampai tiga kali.</p></div></div>}
      {p.job?.status === "processing" && <Button variant="outline" disabled={p.busy} onClick={() => p.onResume(p.job!.id)}><RefreshCw className="h-4 w-4" />Periksa hasil</Button>}
      <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground" disabled={p.busy} aria-expanded={historyOpen} onClick={() => { setHistoryOpen(v => !v); p.onHistory(); }}><History className="h-4 w-4" />Lanjutkan draf sebelumnya<ChevronDown className={cn("h-4 w-4 transition-transform", historyOpen && "rotate-180")} /></button>
      {historyOpen && <div className="space-y-3 rounded-2xl border bg-card p-4">{p.history.length ? <label className="block text-sm">Lanjutkan impor sebelumnya<select className={cn(field, "mt-1")} value={p.history.some(h => h.id === p.job?.id) ? p.job?.id : ""} disabled={p.busy || p.dirty} onChange={e => { if (e.target.value) { p.onResume(e.target.value); setHistoryOpen(false); } }}><option value="">Pilih draf tersimpan</option>{p.history.map((h, i) => <option key={h.id} value={h.id}>Impor {i + 1} · {statusLabel[h.status] ?? "Tersimpan"}</option>)}</select></label> : <p className="text-sm text-muted-foreground">Belum ada impor sebelumnya.</p>}{p.next && <Button size="sm" variant="outline" disabled={p.busy} onClick={() => p.onHistory(p.next!)}>Tampilkan lagi</Button>}</div>}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Batas berkas dan privasi</summary><p className="mt-2 leading-relaxed">Gambar maksimal 16 MP; paling banyak 15 produk per impor. Pada layanan aktif, berkas dibaca Google Vision dan teks diproses penyedia AI. Berkas asli tidak disimpan oleh aplikasi. Informasi yang tidak ditemukan tetap kosong.</p></details>
    </>}

    {review && <>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold">Periksa draf produk</h3><p className="mt-1 text-xs text-muted-foreground">{p.drafts.length} draf · {needs ? `${needs} perlu dilengkapi` : "Nama dan harga lengkap"}</p></div><Button size="sm" variant="outline" disabled={p.busy || p.dirty} onClick={p.onAnother}><ArrowLeft className="h-4 w-4" />Ubah berkas</Button></div>
      <div className="flex items-start gap-2.5 rounded-xl bg-primary-soft/50 p-3 text-sm text-primary-ink dark:bg-primary/10 dark:text-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Cocokkan nama dan harga dengan katalog asli. Hasil bisa keliru.</p></div>
      <div className={cn("grid items-start gap-5", source && "lg:grid-cols-[280px_minmax(0,1fr)]")}>
        {source && <details className="rounded-2xl bg-card p-4 shadow-card lg:sticky lg:top-28" open={sourceOpen} onToggle={e => setSourceOpen(e.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Katalog asli</summary><a href={source} target="_blank" rel="noreferrer" className="mt-3 block"><img src={source} alt="Katalog asli untuk dibandingkan" className="max-h-32 w-full rounded-lg object-contain lg:max-h-[65vh]" /></a><p className="mt-2 text-xs text-muted-foreground">Klik gambar untuk memperbesar.</p></details>}
        <div className="min-w-0 space-y-3">{p.drafts.map((draft, i) => {
          const parsed = candidateSchema.safeParse(draft.candidate);
          const errors = [...missing(draft.candidate), ...(!parsed.success ? ["Periksa harga Rupiah bulat dan format isian produk."] : [])];
          return <fieldset key={draft.id} aria-label={`Produk ${i + 1}`} disabled={p.busy} className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">PRODUK {i + 1}</span><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", errors.length ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success")}>{errors.length ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{errors.length ? "Perlu dilengkapi" : "Siap diperiksa"}</span></div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]"><label className="min-w-0 text-sm font-medium" htmlFor={`draft-${draft.id}-name`}>Nama produk<input id={`draft-${draft.id}-name`} className={cn(field, "mt-1")} maxLength={80} value={draft.candidate.name ?? ""} placeholder="Nama produk dari katalog" onChange={e => p.onChange(draft.id, "name", e.target.value)} /></label><div><label htmlFor={`draft-${draft.id}-price`} className="text-sm font-medium">Harga Rupiah</label><MoneyInput id={`draft-${draft.id}-price`} className="mt-1" value={draft.candidate.price == null ? "" : String(draft.candidate.price)} onChange={value => p.onChange(draft.id, "price", value)} placeholder="Isi harga" /></div></div>
            {errors.length > 0 && <p role="alert" className="mt-2 text-xs text-destructive">{errors.join(" ")}</p>}
            <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-medium text-muted-foreground">Deskripsi & catatan tambahan</summary><div className="mt-3 space-y-3"><label className="block text-sm" htmlFor={`draft-${draft.id}-description`}>Deskripsi<Textarea id={`draft-${draft.id}-description`} className="mt-1 min-h-20 rounded-[10px] bg-background" value={draft.candidate.description ?? ""} maxLength={1500} placeholder="Opsional" onChange={e => p.onChange(draft.id, "description", e.target.value)} /></label><div className="grid gap-3 sm:grid-cols-2">{([ ["sku", "SKU (catatan)", 80], ["imageUrl", "Tautan gambar (catatan)", 2000] ] as const).map(([name, label, max]) => <label key={name} htmlFor={`draft-${draft.id}-${name}`} className="block text-sm">{label}<input id={`draft-${draft.id}-${name}`} className={cn(field, "mt-1")} maxLength={max} value={draft.candidate[name] ?? ""} placeholder="Opsional" onChange={e => p.onChange(draft.id, name, e.target.value)} /></label>)}</div><p className="text-xs text-muted-foreground">SKU dan tautan gambar menjadi catatan draf, tidak dimasukkan ke produk.</p></div></details>
          </fieldset>;
        })}</div>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-7 sm:px-7"><label className="flex cursor-pointer items-start gap-2.5 text-sm"><input className="mt-0.5 h-4 w-4 accent-primary" type="checkbox" disabled={p.busy || p.incomplete} checked={p.checked} onChange={e => p.onChecked(e.target.checked)} /><span>Saya sudah memeriksa nama, harga, dan informasi yang kosong.</span></label><div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Akan disimpan tersembunyi.</p><div className="flex gap-2"><Button className={cn(!p.dirty && "max-sm:hidden")} variant="outline" disabled={p.busy || !p.dirty} onClick={p.onSaveDraft}>Simpan draf</Button><Button disabled={p.busy || p.incomplete || !p.checked} onClick={p.onConfirm}><PackageCheck className="h-4 w-4" />Simpan {p.drafts.length} produk</Button></div></div></div>
    </>}
    {confirmed && <Section title="Produk berhasil disimpan"><div className="py-5 text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-8 w-8" /></span><p className="text-2xl font-bold">{p.job?.productIds?.length ?? 0} produk ditambahkan</p><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Produk masih tersembunyi dari pembeli. Lengkapi foto dan tampilkan produknya dari halaman Katalog saat Anda siap.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={p.onAnother}><ImagePlus className="h-4 w-4" />Impor katalog lain</Button><Button onClick={p.onDone}>Lihat produk<ArrowRight className="h-4 w-4" /></Button></div></div></Section>}
  </section>;
}
