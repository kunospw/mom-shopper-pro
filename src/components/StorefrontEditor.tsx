import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AccentPicker, LogoPicker, ShopHeaderPreview, SlugField, WhatsAppField } from "@/components/StoreFields";
import { useSlugCheck } from "@/hooks/use-slug-check";
import { storefrontSchema, type StorefrontFields } from "@/lib/catalog";
import { effectiveAccentKey } from "@/lib/branding";
import { toWhatsApp, whatsAppPattern } from "@/lib/store-setup";
import { SHOP_ASSISTANT_ENABLED } from "@/lib/plan-config";
export function StorefrontEditor({
  initial,
  wasPublished = false,
  trialLocked = false,
  trialStarts = false,
  onUpgrade,
  checkSlug,
  onSave,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  initial: StorefrontFields;
  /** The shop is open right now (it can stay open even after the trial ends). */
  wasPublished?: boolean;
  /** The trial/plan ended: a closed shop cannot be reopened. */
  trialLocked?: boolean;
  /** No trial yet: opening the shop starts the 7-day free trial. */
  trialStarts?: boolean;
  onUpgrade?: () => void;
  checkSlug: (slug: string) => Promise<boolean>;
  onSave: (value: StorefrontFields) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { state: slugState, hint: slugHint } = useSlugCheck(draft.slug, initial.slug, checkSlug);
  const [whatsAppError, setWhatsAppError] = useState("");
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
    const whatsapp = toWhatsApp(draft.whatsapp);
    if (whatsapp && !whatsAppPattern.test(whatsapp)) {
      setWhatsAppError("Nomor belum lengkap. Contoh: 0812 3456 7890.");
      setError("Periksa nomor WhatsApp.");
      return;
    }
    if (draft.published && !whatsapp) {
      setWhatsAppError("Isi nomor WhatsApp supaya pembeli bisa memesan.");
      setError("Toko yang dibuka perlu nomor WhatsApp.");
      return;
    }
    const parsed = storefrontSchema.safeParse({ ...draft, whatsapp });
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
          : failure instanceof Error && failure.name === "TrialEndedError"
            ? "Masa uji coba berakhir, jadi katalog belum bisa dibuka lagi."
            : "Pengaturan toko belum tersimpan. Silakan coba lagi.",
      );
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={save} className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        Informasi di bagian ini akan terlihat oleh pembeli. Data akun, rekening,
        dan transaksi tetap terpisah.
      </p>
      <fieldset disabled={saving} className="min-w-0 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="store-name">Nama toko</Label>
          <Input
            id="store-name"
            maxLength={80}
            value={draft.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </div>
        <SlugField value={draft.slug} state={slugState} hint={slugHint} onChange={(value) => change("slug", value)} />
        <WhatsAppField
          value={draft.whatsapp}
          error={whatsAppError}
          onChange={(value) => {
            setWhatsAppError("");
            change("whatsapp", value);
          }}
        />
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
        <AccentPicker value={effectiveAccentKey(draft.accent)} onChange={(value) => change("accent", value)} />
        <LogoPicker name={draft.name} value={draft.logo} onChange={(value) => change("logo", value)} onBusyChange={onBusyChange} />
        <ShopHeaderPreview
          name={draft.name}
          description={draft.description}
          logo={draft.logo}
          accent={effectiveAccentKey(draft.accent)}
          open={draft.published}
        />
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="min-w-0">
            <Label htmlFor="store-published">Buka katalog untuk pembeli</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Saat ditutup, tautan publik tidak menampilkan toko maupun
              produknya. Produk tidak dihapus.
            </p>
            {trialLocked && !wasPublished ? (
              <p id="store-published-note" className="mt-1 text-xs font-medium text-destructive">
                Masa uji coba berakhir, katalog belum bisa dibuka lagi.{" "}
                {onUpgrade && (
                  <button type="button" onClick={onUpgrade} className="font-semibold underline underline-offset-2">
                    Lihat paket
                  </button>
                )}
              </p>
            ) : trialStarts && !wasPublished ? (
              <p id="store-published-note" className="mt-1 text-xs font-medium text-info">
                Membuka katalog memulai uji coba gratis 7 hari.
              </p>
            ) : null}
          </div>
          <Switch
            id="store-published"
            checked={draft.published}
            disabled={trialLocked && !wasPublished}
            aria-describedby="store-published-note"
            onCheckedChange={(value) => change("published", value)}
          />
        </div>
        {SHOP_ASSISTANT_ENABLED && (
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <Label htmlFor="store-assistant">Asisten tanya-jawab otomatis</Label>
              <p id="store-assistant-note" className="mt-1 text-xs text-muted-foreground">
                Menjawab pertanyaan pembeli dari katalog Anda. Stok, ongkir dan pembayaran tetap lewat WhatsApp Anda.
                {!draft.published && " Aktif saat toko dibuka."}
              </p>
            </div>
            <Switch
              id="store-assistant"
              checked={draft.assistant === true}
              aria-describedby="store-assistant-note"
              onCheckedChange={(value) => change("assistant", value)}
            />
          </div>
        )}
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
