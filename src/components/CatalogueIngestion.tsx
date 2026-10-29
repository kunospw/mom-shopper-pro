import { useEffect, useState } from "react";
import { CatalogueIngestionView } from "./CatalogueIngestionView";
import { catalogPhoto } from "@/lib/catalog-image";
import { catalogueRequest, importShopee, uploadCatalogue, type ReviewJob } from "@/lib/catalogue-client";
import { candidateSchema, missing, retiredPipelines, type Candidate, type Draft } from "@/lib/catalogue-ingestion";

export function CatalogueIngestion({ uid, onSaved, onDone, onDirtyChange, onBusyChange }: {
  uid: string; onSaved(): void; onDone(): void; onDirtyChange(value: boolean): void; onBusyChange(value: boolean): void;
}) {
  const key = `larisku-catalogue-job:${uid}`;
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [shareText, setShareText] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("Memuat draf…");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<{ id: string; status: string }[]>([]);
  const [next, setNext] = useState<string | null>(null);
  async function loadHistory(after?: string) {
    const result = await catalogueRequest<{ jobs: typeof history; next: string | null }>({ action: "list", ...(after ? { after } : {}) });
    setHistory(rows => after ? [...rows, ...result.jobs] : result.jobs); setNext(result.next); return result.jobs;
  }
  function accept(next: ReviewJob) {
    localStorage.setItem(key, next.id);
    setJob(next); setDrafts(next.drafts); setDirty(false); onDirtyChange(false); setChecked(false);
  }
  async function run(action: () => Promise<void>, label = "Memuat draf…") {
    setBusy(true); onBusyChange(true); setActivity(label); setError(""); setSlow(false);
    const timer = setTimeout(() => setSlow(true), 5000);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Belum berhasil. Coba lagi."); }
    finally { clearTimeout(timer); setBusy(false); onBusyChange(false); }
  }
  useEffect(() => {
    const id = localStorage.getItem(key);
    void run(async () => { const jobs = await loadHistory(); const resume = id ?? (jobs.filter(j => j.status === "review").length === 1 ? jobs.find(j => j.status === "review")?.id : null); if (resume) { const value = await catalogueRequest({ action: "status", jobId: resume }); if (import.meta.env.VITE_FIREBASE_EMULATOR === "1" && import.meta.env.VITE_CATALOGUE_PREVIEW_REAL === "1" && retiredPipelines.includes(value.pipeline ?? "legacy")) localStorage.removeItem(key); else accept(value); } });
    // One resume per seller; processing can also be refreshed manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  function change(id: string, field: keyof Candidate, value: string) {
    setDrafts(rows => rows.map(d => d.id === id ? { ...d, candidate: { ...d.candidate, [field]: field === "price" ? (value === "" ? null : Number(value)) : (value || null) } } : d));
    setChecked(false); setDirty(true); onDirtyChange(true);
  }
  function photo(id: string, value: File) {
    void run(async () => {
      const image = await catalogPhoto(value);
      setDrafts(rows => rows.map(d => d.id === id ? { ...d, photo: image } : d));
      setChecked(false); setDirty(true); onDirtyChange(true);
    }, "Menyiapkan foto…");
  }
  const photoRequired = job?.source?.kind === "shopee";
  const incomplete = drafts.some(d => missing(d.candidate, d.photo, photoRequired).length > 0 || !candidateSchema.safeParse(d.candidate).success);
  function another() { setJob(null); setDrafts([]); setFile(null); setShareText(""); setDirty(false); setChecked(false); onDirtyChange(false); localStorage.removeItem(key); }
  return <CatalogueIngestionView job={job} drafts={drafts} file={file} busy={busy} activity={activity} progress={progress} error={error} slow={slow} dirty={dirty} checked={checked} incomplete={incomplete} history={history} next={next}
    onPick={value => { setFile(value); setProgress(0); setError(""); }} onChange={change} onPhoto={photo} onChecked={setChecked}
    onUpload={() => void run(async () => { setProgress(0); accept(await uploadCatalogue(file!, setProgress)); await loadHistory(); }, "Membaca katalog…")}
    shareText={shareText} onShareText={value => { setShareText(value); setError(""); }}
    onShopee={() => void run(async () => { accept(await importShopee(shareText.trim())); await loadHistory(); }, "Membaca tautan Shopee…")}
    onSaveDraft={() => void run(async () => accept(await catalogueRequest({ action: "save", jobId: job!.id, drafts })), "Menyimpan draf…")}
    onConfirm={() => void run(async () => { const current = dirty ? await catalogueRequest({ action: "save", jobId: job!.id, drafts }) : job!; if (dirty) accept(current); accept(await catalogueRequest({ action: "confirm", jobId: current.id, revision: current.revision, confirmed: true })); onSaved(); }, "Menyimpan produk…")}
    onResume={id => void run(async () => accept(await catalogueRequest({ action: "status", jobId: id })))} onHistory={after => void run(() => loadHistory(after).then(() => {}))} onAnother={another} onDone={onDone} />;
}
