import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  productSchema,
  emptyProduct,
  type CatalogProduct,
  type CatalogProductFields,
} from "@/lib/catalog";
import { catalogPhoto } from "@/lib/catalog-image";
import type { Inventory } from "@/types/books";
export function ProductEditor({
  product,
  inventory,
  onSave,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  product?: CatalogProduct;
  inventory?: Inventory;
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
  const [optionText, setOptionText] = useState(
    product?.options.join(", ") || "",
  );
  const [cost, setCost] = useState(String(inventory?.cost || ""));
  const [trackStock, setTrackStock] = useState(
    typeof inventory?.stock === "number",
  );
  const [stock, setStock] = useState(String(inventory?.stock ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  function change<K extends keyof CatalogProductFields>(
    key: K,
    value: CatalogProductFields[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    onDirtyChange(true);
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    onBusyChange(true);
    setError("");
    try {
      change("image", await catalogPhoto(file));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Foto tidak dapat dibaca.",
      );
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || uploading) return;
    const result = productSchema.safeParse({
      ...draft,
      options: optionText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      leadTime: draft.availability === "preorder" ? draft.leadTime : "",
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    try {
      await onSave(result.data, {
        cost: Math.max(0, Math.round(Number(cost)) || 0),
        stock: trackStock ? Math.round(Number(stock)) || 0 : null,
      });
    } catch {
      setError(
        "Produk belum tersimpan. Isian tetap tersedia; silakan coba lagi.",
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={saving || uploading} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product-name">Nama produk</Label>
          <Input
            id="product-name"
            required
            maxLength={80}
            value={draft.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-photo">Foto produk</Label>
          <div className="flex flex-wrap items-center gap-3">
            {draft.image ? (
              <img
                src={draft.image}
                alt="Foto produk yang dipilih"
                className="h-28 w-28 rounded-lg border object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed">
                <ImagePlus className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                id="product-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="h-auto py-3"
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP hingga 10 MB. Foto diperkecil otomatis untuk
                katalog.
              </p>
              {draft.image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => change("image", "")}
                >
                  <X />
                  Hapus foto
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-price">Harga jual (Rp)</Label>
            <Input
              id="product-price"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000000}
              step={1}
              required
              value={draft.price || ""}
              onChange={(event) => change("price", Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-category">Kategori</Label>
            <Input
              id="product-category"
              maxLength={40}
              placeholder="Contoh: Pakaian"
              value={draft.category}
              onChange={(event) => change("category", event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-description">Deskripsi</Label>
          <Textarea
            id="product-description"
            rows={4}
            maxLength={1500}
            value={draft.description}
            onChange={(event) => change("description", event.target.value)}
            placeholder="Bahan, ukuran, isi paket, atau informasi lain yang dibutuhkan pembeli."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-availability">Ketersediaan</Label>
          <Select
            value={draft.availability}
            onValueChange={(value) =>
              change(
                "availability",
                value as CatalogProductFields["availability"],
              )
            }
          >
            <SelectTrigger id="product-availability">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ready">Ready stock</SelectItem>
              <SelectItem value="preorder">Preorder</SelectItem>
              <SelectItem value="unavailable">Belum tersedia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {draft.availability === "preorder" && (
          <div className="space-y-2">
            <Label htmlFor="product-lead-time">Estimasi waktu preorder</Label>
            <Input
              id="product-lead-time"
              required
              maxLength={100}
              value={draft.leadTime}
              onChange={(event) => change("leadTime", event.target.value)}
              placeholder="Contoh: 7–10 hari setelah konfirmasi"
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="option-label">Nama pilihan</Label>
            <Input
              id="option-label"
              required
              maxLength={30}
              value={draft.optionLabel}
              onChange={(event) => change("optionLabel", event.target.value)}
              placeholder="Contoh: Warna"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-options">Pilihan produk</Label>
            <Input
              id="product-options"
              value={optionText}
              onChange={(event) => {
                setOptionText(event.target.value);
                onDirtyChange(true);
              }}
              placeholder="Hitam, Putih, Krem"
            />
            <p className="text-xs text-muted-foreground">
              Opsional, pisahkan dengan koma. Maksimal 8 pilihan dengan harga
              yang sama.
            </p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="product-published">Tampilkan di katalog</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Produk tersembunyi hanya terlihat oleh pemilik. Toko juga harus
              dibuka agar pembeli dapat mengaksesnya.
            </p>
          </div>
          <Switch
            id="product-published"
            checked={draft.published}
            onCheckedChange={(value) => change("published", value)}
          />
        </div>
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold">Modal & stok (privat)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Hanya terlihat oleh Anda. Tidak pernah tampil di katalog pembeli.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-cost">Modal per unit (Rp)</Label>
            <Input
              id="product-cost"
              type="number"
              inputMode="numeric"
              min={0}
              value={cost}
              onChange={(event) => {
                setCost(event.target.value);
                onDirtyChange(true);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="product-track">Hitung stok otomatis</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Stok berkurang saat penjualan dicatat dan bertambah saat
                pembelian dicatat.
              </p>
            </div>
            <Switch
              id="product-track"
              checked={trackStock}
              onCheckedChange={(value) => {
                setTrackStock(value);
                onDirtyChange(true);
              }}
            />
          </div>
          {trackStock && (
            <div className="space-y-2">
              <Label htmlFor="product-stock">Stok saat ini</Label>
              <Input
                id="product-stock"
                type="number"
                inputMode="numeric"
                value={stock}
                onChange={(event) => {
                  setStock(event.target.value);
                  onDirtyChange(true);
                }}
              />
            </div>
          )}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={saving || uploading}
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button type="submit" disabled={saving || uploading}>
          {(saving || uploading) && <Loader2 className="animate-spin" />}
          {uploading
            ? "Menyiapkan foto…"
            : saving
              ? "Menyimpan…"
              : "Simpan produk"}
        </Button>
      </div>
    </form>
  );
}
