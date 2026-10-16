import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { Check, Copy, Download, Hourglass, Image as ImageIcon, Link2, Loader2, Megaphone, MessageCircle, Share2, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/use-plan";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import { getAccent, isBusinessLogo } from "@/lib/branding";
import {
  MAX_PROMO_PRODUCTS,
  bioText,
  buildBroadcast,
  productLink,
  promoPrice,
  promoTemplates,
  shopLink,
  statusText,
  type PromoTemplate,
} from "@/lib/promo";
import type { CatalogProduct, Storefront } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Format = "story" | "post";
const SIZE: Record<Format, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: "Status / Story 9:16" },
  post: { w: 1080, h: 1080, label: "Postingan 1:1" },
};

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} disalin`);
  } catch {
    toast.error("Belum bisa menyalin. Pilih teksnya lalu salin manual.");
  }
}

/** The image that is exported. Inline styles only, so html2canvas renders it exactly. */
const PromoCard = forwardRef<HTMLDivElement, { store: Storefront; products: CatalogProduct[]; format: Format; title: string; origin: string }>(
  function PromoCard({ store, products, format, title, origin }, ref) {
    const accent = getAccent(store.accent);
    const color = `hsl(${accent.color})`;
    const soft = `hsl(${accent.soft})`;
    const ink = `hsl(${accent.ink})`;
    const { w, h } = SIZE[format];
    const shown = products.slice(0, 4);
    const cols = shown.length <= 1 ? 1 : 2;
    const link = shopLink(store, origin).replace(/^https?:\/\//, "");
    return (
      <div
        ref={ref}
        style={{
          width: w,
          height: h,
          background: soft,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          color: "#24332B",
          display: "flex",
          flexDirection: "column",
          padding: format === "story" ? "120px 72px 110px" : "64px 64px 56px",
          gap: format === "story" ? 48 : 32,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {isBusinessLogo(store.logo) ? (
            <img src={store.logo} alt="" style={{ width: 120, height: 120, borderRadius: 999, objectFit: "cover", border: "6px solid #fff", background: "#fff" }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: 999, background: "#D29B75", color: "#fff", fontSize: 54, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "6px solid #fff" }}>
              {(store.name.trim()[0] || "T").toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>{store.name}</div>
        </div>
        <div style={{ fontSize: format === "story" ? 84 : 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, color: ink }}>{title}</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 28, flex: 1, alignContent: "start" }}>
          {shown.map((p) => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 36, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ aspectRatio: format === "post" && shown.length > 2 ? "16 / 10" : "1 / 1", borderRadius: 26, overflow: "hidden", background: "#F1EDE6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: 30, color: "#8C7A68" }}>{p.name}</div>}
              </div>
              <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: ink }}>{promoPrice(p)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: color, color: "#fff", borderRadius: 40, padding: "30px 40px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 34, opacity: 0.9 }}>Pesan lewat katalog, konfirmasi via WhatsApp</div>
          <div style={{ fontSize: 44, fontWeight: 700, wordBreak: "break-all" }}>{link}</div>
        </div>
      </div>
    );
  },
);

export default function Promote() {
  const { user } = useAuth();
  const { plan, loaded: planLoaded, openUpgrade } = usePlan();
  const [store, setStore] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [template, setTemplate] = useState<PromoTemplate>("new");
  const [headline, setHeadline] = useState("");
  const [note, setNote] = useState("");
  const [short, setShort] = useState(false);
  const [format, setFormat] = useState<Format>("story");
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(300);
  const origin = window.location.origin;

  useEffect(() => {
    getOwnerCatalog()
      .then((c) => {
        setStore(c.store);
        const live = c.products.filter((p) => p.published && p.availability !== "unavailable");
        setProducts(live);
        setSelected(live.slice(0, 3).map((p) => p.id));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [user?.uid]);
  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setPreviewWidth(Math.max(200, Math.min(360, entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const picked = useMemo(() => selected.map((id) => products.find((p) => p.id === id)).filter(Boolean) as CatalogProduct[], [selected, products]);
  const title = headline.trim() || promoTemplates.find((t) => t.id === template)!.label;
  const message = store
    ? short
      ? statusText({ store, products: picked, template, headline, note, origin })
      : buildBroadcast({ store, products: picked, template, headline, note, origin })
    : "";

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_PROMO_PRODUCTS ? current : [...current, id],
    );
  }
  async function renderImage() {
    if (!exportRef.current) throw new Error("no template");
    const canvas = await html2canvas(exportRef.current, { scale: 1, useCORS: true, backgroundColor: null, logging: false });
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png"));
  }
  const fileName = () => `promo-${store?.slug || "toko"}-${format}.png`;
  async function download() {
    setExporting(true);
    try {
      const blob = await renderImage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error("Gambar belum bisa dibuat. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }
  async function shareImage() {
    setExporting(true);
    try {
      const file = new File([await renderImage()], fileName(), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: message });
      else await download();
    } catch {
      /* Cancelled or unsupported; nothing changed. */
    } finally {
      setExporting(false);
    }
  }

  const header = (
    <header>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Promosi</h1>
      <p className="mt-1 text-sm text-muted-foreground">Siapkan pesan siaran dan gambar status WhatsApp dari produk katalog Anda.</p>
    </header>
  );
  if (loading || !planLoaded)
    return (
      <>
        {header}
        <div role="status" aria-label="Memuat promosi" className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </>
    );
  const gate = failed
    ? { Icon: Store, title: "Katalog belum dapat dimuat", body: "Periksa koneksi Anda lalu buka halaman ini lagi.", action: null }
    : !store
      ? { Icon: Store, title: "Siapkan toko dulu", body: "Isi nama toko dan nomor WhatsApp, tambahkan produk, lalu buka katalog.", action: <Button asChild><Link to="/catalog?store=edit">Atur toko</Link></Button> }
      : plan.phase === "expired" || (plan.phase === "none" && store.published)
        ? { Icon: Hourglass, title: "Masa uji coba berakhir", body: "Promosi mengarahkan pembeli ke katalog, yang sedang tidak menerima pesanan. Aktifkan paket untuk membukanya lagi.", action: <Button onClick={openUpgrade}>Lihat paket</Button> }
        : !store.published
          ? { Icon: Store, title: "Katalog masih ditutup", body: "Buka katalog dulu supaya pembeli bisa memesan dari tautan yang Anda bagikan.", action: <Button asChild><Link to="/catalog?store=edit">Buka katalog</Link></Button> }
          : products.length === 0
            ? { Icon: ShoppingBag, title: "Belum ada produk yang ditampilkan", body: "Tambahkan atau tampilkan produk di Katalog untuk mulai berpromosi.", action: <Button asChild><Link to="/catalog?new=product">Tambah produk</Link></Button> }
            : null;
  if (gate)
    return (
      <>
        {header}
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <gate.Icon className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{gate.title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{gate.body}</p>
          {gate.action}
        </Card>
      </>
    );

  const size = SIZE[format];
  const scale = previewWidth / size.w;
  return (
    <>
      {header}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
        <div className="flex flex-col gap-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">1. Pilih produk</h2>
              <span className="text-[13px] text-muted-foreground">{selected.length} dari maks. {MAX_PROMO_PRODUCTS}</span>
            </div>
            <ul aria-label="Produk untuk promosi" className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && selected.length >= MAX_PROMO_PRODUCTS}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "relative flex w-full flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        on ? "border-primary bg-primary-soft dark:bg-primary/15" : "hover:bg-accent",
                      )}
                    >
                      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#F1EDE6] dark:bg-muted">
                        {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />}
                      </span>
                      <span className="line-clamp-1 text-[13px] font-semibold">{p.name}</span>
                      <span className="num text-xs text-muted-foreground">{promoPrice(p)}</span>
                      {on && (
                        <span aria-hidden="true" className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold">2. Pesan siaran</h2>
            <div role="group" aria-label="Jenis promosi" className="mt-3 inline-flex flex-wrap rounded-xl bg-muted p-1">
              {promoTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={template === t.id}
                  onClick={() => setTemplate(t.id)}
                  className={cn("h-9 rounded-lg px-3 text-[13px]", template === t.id ? "bg-card font-semibold shadow-card" : "text-muted-foreground hover:text-foreground")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label htmlFor="promo-headline" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                <span>Judul <span className="font-normal text-muted-foreground">(opsional)</span></span>
                <input id="promo-headline" maxLength={60} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Contoh: Diskon 10% sampai Minggu" className="h-11 rounded-[10px] border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </label>
              <label htmlFor="promo-note" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                <span>Catatan <span className="font-normal text-muted-foreground">(opsional)</span></span>
                <input id="promo-note" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Ongkir gratis area Bekasi" className="h-11 rounded-[10px] border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={short} onChange={(e) => setShort(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Versi status WhatsApp (lebih pendek, tanpa tautan per produk)
            </label>
            <section aria-label="Pratinjau pesan" className="mt-4 rounded-2xl bg-[#EFEAE2] p-3.5 dark:bg-muted">
              <p className="max-w-[92%] whitespace-pre-line break-words rounded-xl rounded-br-sm bg-[#DCF3D3] px-3 py-2.5 text-[13px] leading-normal text-[#1D2A22] sm:ml-auto">{message}</p>
            </section>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copy(message, "Pesan")}><Copy /> Salin pesan</Button>
              <Button asChild variant="outline" className="text-success hover:text-success">
                <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> Kirim ke WhatsApp</a>
              </Button>
              {"share" in navigator && (
                <Button type="button" variant="outline" onClick={() => void navigator.share({ text: message }).catch(() => {})}><Share2 /> Bagikan</Button>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Link2 className="h-4 w-4" aria-hidden="true" />Tautan</h2>
            <ul className="mt-3 divide-y text-sm">
              {[
                { label: "Tautan toko", value: shopLink(store!, origin) },
                { label: "Bio WhatsApp", value: bioText(store!, origin) },
                ...picked.map((p) => ({ label: p.name, value: productLink(store!, p, origin) })),
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{row.label}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{row.value}</span>
                  </span>
                  <Button type="button" variant="outline" size="sm" aria-label={`Salin ${row.label}`} onClick={() => void copy(row.value, row.label)}>
                    <Copy /> Salin
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-5 sm:p-6 xl:sticky xl:top-20">
          <h2 className="flex items-center gap-2 text-base font-semibold"><ImageIcon className="h-4 w-4" aria-hidden="true" />3. Gambar status</h2>
          <div role="group" aria-label="Ukuran gambar" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(Object.keys(SIZE) as Format[]).map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={cn("h-9 rounded-lg text-[13px]", format === f ? "bg-card font-semibold shadow-card" : "text-muted-foreground")}>
                {SIZE[f].label}
              </button>
            ))}
          </div>
          <div ref={previewBox} className="mt-4 flex justify-center">
            <div
              role="img"
              aria-label={`Pratinjau gambar ${SIZE[format].label}: ${title}, ${picked.length} produk`}
              className="overflow-hidden rounded-2xl shadow-pop"
              style={{ width: size.w * scale, height: size.h * scale }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <PromoCard store={store!} products={picked} format={format} title={title} origin={origin} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Menampilkan maks. 4 produk pertama yang dipilih.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" disabled={exporting || picked.length === 0} onClick={() => void download()}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Unduh gambar
            </Button>
            <Button type="button" variant="outline" disabled={exporting || picked.length === 0} onClick={() => void shareImage()}>
              <Share2 /> Bagikan
            </Button>
          </div>
        </Card>
      </div>
      {/* Unscaled copy used for the export; kept off screen. */}
      <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        <PromoCard ref={exportRef} store={store!} products={picked} format={format} title={title} origin={origin} />
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
        Kirim ke grup, status, atau pelanggan lama. Pesanan dari tautan masuk ke menu Pesanan.
      </p>
    </>
  );
}
