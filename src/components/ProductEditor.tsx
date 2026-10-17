import { useRef, useState } from "react";
import { Crop, ImagePlus, Loader2, Lock, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MoneyInput, Section, Segmented, field, parseRupiah } from "@/components/form-parts";
import { AvailabilityBadge, priceLabel, productMeta } from "@/components/ShopProductCard";
import { productSchema, emptyProduct, type CatalogProduct, type CatalogProductFields } from "@/lib/catalog";
import { centerCrop, loadPhoto, squarePhoto, type PhotoCrop } from "@/lib/catalog-image";
import { PhotoCropper } from "@/components/PhotoCropper";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Inventory } from "@/types/books";

const optionLabelIdeas = ["Ukuran", "Warna", "Varian", "Rasa", "Paket"];

/**
 * Product form for the Katalog slide-over: numbered sections on the left, a
 * buyer-card preview with the publish switch and margin on the right.
 */
export function ProductEditor({
  product,
  inventory,
  categories = [],
  onSave,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  product?: CatalogProduct;
  inventory?: Inventory;
  /** Categories already used, offered as suggestions. */
  categories?: string[];
  onSave: (value: CatalogProductFields, inventory: Inventory) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<CatalogProductFields>(() => {
    if (!product) return { ...emptyProduct };
    const { id: _id, ...fields } = product;
    return fields;
  });
  const [price, setPrice] = useState(product?.price ? String(product.price) : "");
  const [optionRows, setOptionRows] = useState(
    () => product?.options.map((o) => ({ label: o.label, price: o.price ? String(o.price) : "" })) ?? [],
  );
  const [cost, setCost] = useState(String(inventory?.cost || ""));
  const [trackStock, setTrackStock] = useState(typeof inventory?.stock === "number");
  const [stock, setStock] = useState(String(inventory?.stock ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  // The full photo as chosen, so the square crop can be adjusted without quality loss.
  const [photoSource, setPhotoSource] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>(centerCrop);
  const [cropping, setCropping] = useState(false);

  function change<K extends keyof CatalogProductFields>(key: K, value: CatalogProductFields[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
    onDirtyChange(true);
  }
  function editOptions(update: (rows: typeof optionRows) => typeof optionRows) {
    setOptionRows(update);
    setError("");
    onDirtyChange(true);
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    onBusyChange(true);
    setPhotoError("");
    try {
      const image = await loadPhoto(file);
      change("image", squarePhoto(image));
      setPhotoSource(image);
      setCrop(centerCrop);
    } catch (failure) {
      setPhotoError(failure instanceof Error ? failure.message : "Foto tidak dapat dibaca.");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  async function adjustPhoto() {
    setPhotoError("");
    if (!photoSource && draft.image) {
      try {
        setPhotoSource(await loadPhoto(draft.image));
        setCrop(centerCrop);
      } catch {
        setPhotoError("Foto ini belum bisa disesuaikan. Unggah ulang fotonya.");
        return;
      }
    }
    setCropping(true);
  }

  const options = optionRows
    .map((row) => ({ label: row.label.trim(), price: parseRupiah(row.price) }))
    .filter((row) => row.label);
  const preview: CatalogProduct = { ...draft, id: product?.id ?? "preview", price: parseRupiah(price), options };
  const unitCost = parseRupiah(cost);
  const margin = preview.price > 0 && unitCost > 0 ? preview.price - unitCost : null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || uploading) return;
    const result = productSchema.safeParse({
      ...draft,
      price: parseRupiah(price),
      options,
      leadTime: draft.availability === "preorder" ? draft.leadTime : "",
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (trackStock && stock.trim() === "") {
      setError("Isi stok saat ini, atau matikan hitung stok.");
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    try {
      await onSave(result.data, {
        cost: unitCost,
        stock: trackStock ? Math.round(Number(stock)) || 0 : null,
      });
    } catch {
      setError("Produk belum tersimpan. Isian tetap tersedia; silakan coba lagi.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const busy = saving || uploading;
  const meta = productMeta(preview);
  return (
    <>
    {cropping && (
      <PhotoCropper
        image={photoSource}
        initial={crop}
        onCancel={() => setCropping(false)}
        onDone={(data, next) => {
          change("image", data);
          setCrop(next);
          setCropping(false);
        }}
      />
    )}
    <form onSubmit={save} noValidate className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Section step={1} title="Foto & nama">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-input bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-describedby="product-photo-hint"
              >
                {draft.image ? (
                  <img src={draft.image} alt="Foto produk yang dipilih" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                    {uploading ? "Menyiapkan…" : "Tambah foto"}
                  </span>
                )}
                <span className="sr-only">{draft.image ? "Ganti foto produk" : "Tambah foto produk"}</span>
              </button>
              <input
                ref={photoInput}
                id="product-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="Foto produk"
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {draft.image && (
                <div className="mt-1.5 flex w-32 flex-col items-start gap-1">
                  <button type="button" className="flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline" onClick={() => void adjustPhoto()}>
                    <Crop className="h-3.5 w-3.5" aria-hidden="true" /> Sesuaikan foto
                  </button>
                  <button type="button" className="flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => { change("image", ""); setPhotoSource(null); }}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Hapus foto
                  </button>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-name">Nama produk</Label>
                <input id="product-name" className={field} required maxLength={80} value={draft.name} placeholder="Contoh: Gamis Katun Rayon" onChange={(event) => change("name", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category">
                  Kategori <span className="font-normal text-muted-foreground">(opsional)</span>
                </Label>
                <input id="product-category" className={field} list="product-categories" maxLength={40} placeholder="Contoh: Pakaian" value={draft.category} onChange={(event) => change("category", event.target.value)} />
                <datalist id="product-categories">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
          <p id="product-photo-hint" className={cn("mt-3 text-xs", photoError ? "text-destructive" : "text-muted-foreground")} role={photoError ? "alert" : undefined}>
            {photoError || "PNG, JPG, atau WebP hingga 10 MB. Foto otomatis dipotong persegi di tengah dan diperkecil; tekan Sesuaikan foto untuk memilih bagiannya."}
          </p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="product-description">
              Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Textarea
              id="product-description"
              rows={4}
              maxLength={1500}
              value={draft.description}
              onChange={(event) => change("description", event.target.value)}
              placeholder="Bahan, ukuran, isi paket, atau informasi lain yang dibutuhkan pembeli."
            />
          </div>
        </Section>

        <Section step={2} title="Harga & pilihan">
          <div className="space-y-1.5">
            <Label htmlFor="product-price">Harga jual</Label>
            <MoneyInput id="product-price" value={price} onChange={(value) => { setPrice(value); setError(""); onDirtyChange(true); }} className="sm:max-w-[240px]" />
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-sm font-medium">
              Pilihan produk <span className="font-normal text-muted-foreground">(opsional, maks. 8)</span>
            </p>
            <p className="text-xs text-muted-foreground">Misalnya ukuran atau warna. Isi harga hanya jika pilihan itu harganya berbeda.</p>
            {optionRows.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="option-label">Nama pilihan</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input id="option-label" className={cn(field, "w-40")} required maxLength={30} value={draft.optionLabel} placeholder="Contoh: Warna" onChange={(event) => change("optionLabel", event.target.value)} />
                  {optionLabelIdeas
                    .filter((idea) => idea !== draft.optionLabel)
                    .map((idea) => (
                      <button key={idea} type="button" className="h-8 rounded-full border px-3 text-xs font-medium hover:bg-accent" onClick={() => change("optionLabel", idea)}>
                        {idea}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {optionRows.map((row, index) => (
                <li key={index} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor={`opt-label-${index}`} className="text-xs">
                      {draft.optionLabel || "Pilihan"} {index + 1}
                    </Label>
                    <input
                      id={`opt-label-${index}`}
                      className={field}
                      maxLength={50}
                      value={row.label}
                      placeholder="Contoh: Hitam"
                      onChange={(event) => editOptions((rows) => rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label htmlFor={`opt-price-${index}`} className="text-xs">Harga</Label>
                    <MoneyInput id={`opt-price-${index}`} value={row.price} placeholder="Sama" onChange={(value) => editOptions((rows) => rows.map((r, i) => (i === index ? { ...r, price: value } : r)))} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Hapus pilihan ${index + 1}`} onClick={() => editOptions((rows) => rows.filter((_, i) => i !== index))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" disabled={optionRows.length >= 8} onClick={() => editOptions((rows) => [...rows, { label: "", price: "" }])}>
              <Plus /> Tambah pilihan
            </Button>
          </div>
        </Section>

        <Section step={3} title="Ketersediaan">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Jenis produk</p>
              <Segmented
                label="Jenis produk"
                value={draft.kind}
                onChange={(value) => change("kind", value)}
                options={[
                  { value: "physical", label: "Barang fisik" },
                  { value: "digital", label: "Produk digital" },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                {draft.kind === "digital" ? "Dikirim lewat WhatsApp setelah pembayaran. Tidak perlu ongkir." : "Dikirim ke alamat pembeli."}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Status</p>
              <Segmented
                label="Ketersediaan"
                value={draft.availability}
                onChange={(value) => change("availability", value)}
                options={[
                  { value: "ready", label: "Ready" },
                  { value: "preorder", label: "Preorder" },
                  { value: "unavailable", label: "Belum tersedia" },
                ]}
              />
            </div>
            {draft.availability === "preorder" && (
              <div className="space-y-1.5">
                <Label htmlFor="product-lead-time">Estimasi waktu preorder</Label>
                <input id="product-lead-time" className={field} required maxLength={100} value={draft.leadTime} onChange={(event) => change("leadTime", event.target.value)} placeholder="Contoh: 7–10 hari" />
              </div>
            )}
          </div>
        </Section>

        <Section step={4} title="Modal & stok" hint={<span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Hanya Anda</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-cost">Modal per unit</Label>
              <MoneyInput id="product-cost" value={cost} onChange={(value) => { setCost(value); onDirtyChange(true); }} />
              <p className="text-xs text-muted-foreground">Dipakai untuk menghitung keuntungan. Tidak pernah tampil di katalog.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="product-track">Hitung stok otomatis</Label>
                <Switch id="product-track" checked={trackStock} onCheckedChange={(value) => { setTrackStock(value); onDirtyChange(true); }} />
              </div>
              {trackStock ? (
                <>
                  <Label htmlFor="product-stock" className="sr-only">Stok saat ini</Label>
                  <input id="product-stock" className={cn(field, "num")} type="number" inputMode="numeric" placeholder="Stok saat ini" value={stock} onChange={(event) => { setStock(event.target.value); setError(""); onDirtyChange(true); }} />
                  <p className="text-xs text-muted-foreground">Berkurang saat penjualan dicatat, bertambah saat pembelian dicatat.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nyalakan untuk melacak sisa stok dari penjualan dan pembelian.</p>
              )}
            </div>
          </div>
        </Section>
      </fieldset>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <p className="mb-3 text-[13px] font-semibold text-muted-foreground">Pratinjau di katalog</p>
          <div className={cn("mx-auto flex max-w-[200px] flex-col gap-1.5", draft.availability === "unavailable" && "opacity-60")} aria-hidden="true">
            <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#F1EDE6] dark:bg-muted">
              {draft.image ? <img src={draft.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-10 w-10 text-[#8C7A68]/40 dark:text-muted-foreground/50" />}
              <AvailabilityBadge product={preview} className="absolute left-2 top-2" />
            </span>
            <span className="line-clamp-2 break-words text-[13.5px] font-semibold leading-tight">{draft.name || "Nama produk"}</span>
            {meta && <span className="line-clamp-1 text-xs text-muted-foreground">{meta}</span>}
            <span className="num text-[14.5px] font-bold text-primary-ink dark:text-primary">{preview.price > 0 ? priceLabel(preview) : "Rp 0"}</span>
          </div>
          {margin !== null && (
            <p className={cn("mt-4 rounded-lg px-3 py-2 text-[13px]", margin >= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
              {margin >= 0 ? "Untung per unit" : "Rugi per unit"} <span className="num font-semibold">{formatRupiah(Math.abs(margin))}</span>
              {margin >= 0 && preview.price > 0 && <span className="num"> · {Math.round((margin / preview.price) * 100)}%</span>}
            </p>
          )}
          <div className="mt-4 flex items-start justify-between gap-3 border-t pt-4">
            <div className="min-w-0">
              <Label htmlFor="product-published">Tampilkan di katalog</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {draft.published ? "Pembeli bisa melihat produk ini saat toko dibuka." : "Tersembunyi. Hanya Anda yang bisa melihat."}
              </p>
            </div>
            <Switch id="product-published" checked={draft.published} disabled={busy} onCheckedChange={(value) => change("published", value)} />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background px-4 py-3 sm:-mx-7 sm:px-7 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="button" variant="outline" className="h-11 rounded-[10px]" disabled={busy} onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" className="h-11 flex-1 rounded-[10px]" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {uploading ? "Menyiapkan foto…" : saving ? "Menyimpan…" : "Simpan produk"}
          </Button>
        </div>
      </aside>
    </form>
    </>
  );
}
