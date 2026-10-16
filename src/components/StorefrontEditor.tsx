import { useEffect, useState } from "react";
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
  normalizeWhatsApp,
  slugSchema,
  storefrontSchema,
  type StorefrontFields,
} from "@/lib/catalog";
export function StorefrontEditor({
  initial,
  checkSlug,
  onSave,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  initial: StorefrontFields;
  checkSlug: (slug: string) => Promise<boolean>;
  onSave: (value: StorefrontFields) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugState, setSlugState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [slugHint, setSlugHint] = useState("");
  useEffect(() => {
    const slug = draft.slug;
    if (!slug || slug === initial.slug) {
      setSlugState("idle");
      setSlugHint("");
      return;
    }
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      setSlugState("invalid");
      setSlugHint(parsed.error.issues[0].message);
      return;
    }
    setSlugState("checking");
    let active = true;
    const timer = window.setTimeout(() => {
      checkSlug(slug)
        .then((free) => {
          if (!active) return;
          setSlugState(free ? "free" : "taken");
          setSlugHint(free ? "Tautan ini tersedia." : "Tautan ini sudah dipakai. Coba nama lain.");
        })
        .catch(() => {
          if (!active) return;
          setSlugState("idle");
          setSlugHint("Ketersediaan belum bisa diperiksa. Anda tetap bisa menyimpan.");
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft.slug, initial.slug, checkSlug]);
  function change<K extends keyof StorefrontFields>(
    key: K,
    value: StorefrontFields[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    onDirtyChange(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = storefrontSchema.safeParse({
      ...draft,
      whatsapp: normalizeWhatsApp(draft.whatsapp),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (slugState === "taken") {
      setError("Tautan toko sudah dipakai. Pilih nama lain.");
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name === "SlugTakenError"
          ? "Tautan toko sudah dipakai. Pilih nama lain."
          : "Pengaturan toko belum tersimpan. Silakan coba lagi.",
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informasi di bagian ini akan terlihat oleh pembeli. Data akun, rekening,
        dan transaksi tetap terpisah.
      </p>
      <fieldset disabled={saving} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="store-name">Nama toko publik</Label>
          <Input
            id="store-name"
            maxLength={80}
            value={draft.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-slug">Tautan toko</Label>
          <div className="flex items-center rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
            <span className="select-none pl-3 text-sm text-muted-foreground">{window.location.host}/shop/</span>
            <input
              id="store-slug"
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-base outline-none md:h-10 md:text-sm"
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="store-slug-hint"
              value={draft.slug}
              onChange={(event) => change("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="tokobunda"
            />
          </div>
          <p
            id="store-slug-hint"
            role="status"
            className={slugState === "taken" || slugState === "invalid" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {slugState === "checking"
              ? "Memeriksa…"
              : slugHint || "Huruf kecil, angka, atau tanda hubung. Tautan lama tetap berfungsi."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-description">Tentang toko</Label>
          <Textarea
            id="store-description"
            maxLength={600}
            value={draft.description}
            onChange={(event) => change("description", event.target.value)}
            placeholder="Ceritakan produk dan cara pemesanan Anda."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-whatsapp">WhatsApp pemesanan</Label>
          <Input
            id="store-whatsapp"
            type="tel"
            value={draft.whatsapp}
            onChange={(event) => change("whatsapp", event.target.value)}
            placeholder="6281234567890"
          />
          <p className="text-xs text-muted-foreground">
            Gunakan kode negara, tanpa awalan 0. Pembeli mengirim permintaan ke
            nomor ini.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="store-accent">Warna katalog</Label>
          <Select
            value={draft.accent}
            onValueChange={(value) =>
              change("accent", value as StorefrontFields["accent"])
            }
          >
            <SelectTrigger id="store-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teal">Hijau laut</SelectItem>
              <SelectItem value="blue">Biru</SelectItem>
              <SelectItem value="violet">Ungu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          {draft.logo && (
            <img
              src={draft.logo}
              alt="Logo publik"
              className="h-12 w-12 object-contain"
            />
          )}
          <p className="flex-1 text-xs text-muted-foreground">
            Logo awal mengikuti logo bisnis saat toko dibuat. Perubahan profil
            bisnis tidak otomatis mengubah katalog publik.
          </p>
          {draft.logo && (
            <Button
              type="button"
              variant="outline"
              onClick={() => change("logo", "")}
            >
              Hapus logo publik
            </Button>
          )}
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="store-published">Buka katalog untuk pembeli</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Saat ditutup, tautan publik tidak menampilkan toko maupun
              produknya. Produk tidak dihapus.
            </p>
          </div>
          <Switch
            id="store-published"
            checked={draft.published}
            onCheckedChange={(value) => change("published", value)}
          />
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
          disabled={saving}
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan toko"}
        </Button>
      </div>
    </form>
  );
}
