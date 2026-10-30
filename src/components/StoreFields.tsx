import { useRef, useState, type CSSProperties } from "react";
import { Check, ImagePlus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShopAvatar } from "@/components/shop/shop-ui";
import type { SlugState } from "@/hooks/use-slug-check";
import { accents, isBusinessLogo, type AccentKey } from "@/lib/branding";
import { buyerPaymentLabels, deliveryLabels, deliveryOptions, paymentOptions, type BuyerPayment, type Delivery } from "@/lib/catalog";
import { formatWhatsApp, toWhatsApp, whatsAppPattern } from "@/lib/store-setup";
import { cn } from "@/lib/utils";

/** Ticks one choice on or off, keeping the fixed order of `all`. */
function pick<T extends string>(all: readonly T[], current: readonly T[] | undefined, value: T, on: boolean) {
  return all.filter((item) => (item === value ? on : !!current?.includes(item)));
}

/** Which delivery and payment choices buyers pick from at checkout. */
export function OrderChoicesFields({
  delivery,
  payments,
  onDelivery,
  onPayments,
}: {
  delivery: readonly Delivery[] | undefined;
  payments: readonly BuyerPayment[] | undefined;
  onDelivery: (value: Delivery[]) => void;
  onPayments: (value: BuyerPayment[]) => void;
}) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">Pengiriman barang fisik</legend>
        {deliveryOptions.map((option) => (
          <div key={option} className="flex items-center gap-2">
            <Checkbox
              id={`store-delivery-${option}`}
              checked={!!delivery?.includes(option)}
              onCheckedChange={(on) => onDelivery(pick(deliveryOptions, delivery, option, on === true))}
            />
            <Label htmlFor={`store-delivery-${option}`} className="font-normal">
              {deliveryLabels[option]}
              {option === "deliver" && <span className="text-muted-foreground"> · pembeli mengisi alamat</span>}
            </Label>
          </div>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">Pembayaran</legend>
        {paymentOptions.map((option) => (
          <div key={option} className="flex items-center gap-2">
            <Checkbox
              id={`store-payment-${option}`}
              checked={!!payments?.includes(option)}
              onCheckedChange={(on) => onPayments(pick(paymentOptions, payments, option, on === true))}
            />
            <Label htmlFor={`store-payment-${option}`} className="font-normal">{buyerPaymentLabels[option]}</Label>
          </div>
        ))}
      </fieldset>
    </>
  );
}

/** Shop link input. The full link is shown on its own line so long hosts never push the form wider than the screen. */
export function SlugField({
  value,
  onChange,
  state,
  hint,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  state: SlugState;
  hint: string;
  autoFocus?: boolean;
}) {
  const invalid = state === "taken" || state === "invalid";
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="store-slug">Tautan toko</Label>
      <div
        className={cn(
          "flex min-w-0 items-center rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring",
          invalid && "border-destructive",
        )}
      >
        <span className="shrink-0 select-none pl-3 text-sm text-muted-foreground">/shop/</span>
        <input
          id="store-slug"
          className="h-11 min-w-0 flex-1 bg-transparent px-1 text-base outline-none md:h-10 md:text-sm"
          maxLength={30}
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus={autoFocus}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby="store-slug-hint store-slug-full"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="tokobunda"
        />
        {state === "free" && <Check className="mr-3 h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
      </div>
      <p id="store-slug-hint" role="status" className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
        {state === "checking" ? "Memeriksa…" : hint || "Huruf kecil, angka, atau tanda hubung. Tautan lama tetap berfungsi."}
      </p>
      <p id="store-slug-full" className="break-all text-xs text-muted-foreground">
        Pembeli membuka: <span className="font-medium text-foreground">{window.location.host}/shop/{value || "…"}</span>
      </p>
    </div>
  );
}

/** WhatsApp number. Accepts 08…, +62… or 62…; shows the number orders will go to. */
export function WhatsAppField({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const normalized = toWhatsApp(value);
  const valid = whatsAppPattern.test(normalized);
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="store-whatsapp">Nomor WhatsApp pesanan</Label>
      <Input
        id="store-whatsapp"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus={autoFocus}
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby="store-whatsapp-hint"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0812 3456 7890"
      />
      <p id="store-whatsapp-hint" className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ||
          (valid ? (
            <>
              Pesanan masuk ke <span className="font-semibold text-foreground">{formatWhatsApp(normalized)}</span>
            </>
          ) : (
            "Boleh diawali 08 atau +62. Pembeli mengirim pesanan ke nomor ini."
          ))}
      </p>
    </div>
  );
}

/** Catalog color as large tiles, each showing how the shop header looks in it. */
export function AccentPicker({ value, onChange, legend = "Warna katalog" }: { value: AccentKey; onChange: (value: AccentKey) => void; legend?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {(Object.keys(accents) as AccentKey[]).map((key) => {
          const choice = accents[key];
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={cn(
                "relative min-h-11 rounded-xl border-2 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected ? "border-foreground" : "border-border hover:border-muted-foreground/60",
              )}
            >
              <span aria-hidden="true" className="flex h-12 items-end gap-1.5 rounded-lg p-2" style={{ backgroundColor: `hsl(${choice.soft})` }}>
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: `hsl(${choice.color})` }} />
                <span className="mb-1 h-1.5 w-8 rounded-full" style={{ backgroundColor: `hsl(${choice.ink})` }} />
              </span>
              <span className="mt-1.5 flex items-center justify-between text-sm font-medium">
                {choice.label}
                {selected && <Check className="h-4 w-4" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Shop logo: preview, upload (PNG/JPG/WebP up to 100 KB) and remove. */
export function LogoPicker({
  name,
  value,
  onChange,
  onBusyChange,
  hint = "Tanpa logo, huruf pertama nama toko yang tampil.",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 100 * 1024) {
      setError("Pilih PNG, JPG, atau WebP maksimal 100 KB.");
      return;
    }
    setReading(true);
    onBusyChange?.(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (!isBusinessLogo(result)) throw new Error("Invalid logo");
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = result;
      });
      onChange(result);
    } catch {
      setError("Gambar tidak dapat dibaca. Pilih file lain.");
    } finally {
      setReading(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium" id="store-logo-label">
        Logo <span className="font-normal text-muted-foreground">(opsional)</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ShopAvatar name={name} logo={value} size={56} ring={false} />
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-labelledby="store-logo-label"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={reading} onClick={() => input.current?.click()}>
          <ImagePlus />
          {reading ? "Membaca…" : value ? "Ganti logo" : "Unggah logo"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" disabled={reading} onClick={() => onChange("")}>
            <Trash2 />
            Hapus
          </Button>
        )}
      </div>
      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {error || hint}
      </p>
    </div>
  );
}

/** Small rendering of the buyer catalog header (B1), in the chosen color. */
export function ShopHeaderPreview({
  name,
  description,
  logo,
  accent,
  open,
}: {
  name: string;
  description: string;
  logo: string;
  accent: AccentKey;
  open: boolean;
}) {
  const theme = accents[accent];
  return (
    <figure className="min-w-0 overflow-hidden rounded-2xl border bg-[#FBFBF8] text-[#24332B]">
      <div className="space-y-3 p-4" style={{ backgroundColor: `hsl(${theme.soft})` } as CSSProperties}>
        <div className="flex min-w-0 items-center gap-3">
          <ShopAvatar name={name || "Toko"} logo={isBusinessLogo(logo) ? logo : ""} size={44} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold" style={{ color: `hsl(${theme.ink})` }}>
              {name.trim() || "Nama toko"}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-[#5E6A62]">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", open ? "bg-[#1F6B40]" : "bg-[#8D978F]")} />
              {open ? "Menerima pesanan" : "Belum dibuka"}
            </p>
          </div>
        </div>
        {description.trim() && <p className="line-clamp-2 text-xs text-[#5E6A62]">{description.trim()}</p>}
        <div className="flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs text-[#5E6A62]">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Cari produk
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3" aria-hidden="true">
        {[0, 1].map((index) => (
          <div key={index} className="rounded-lg bg-white p-2">
            <div className="aspect-[4/3] rounded-md bg-[#F1F2EE]" />
            <div className="mt-2 h-1.5 w-3/4 rounded-full bg-[#E4EAE2]" />
            <div className="mt-1.5 h-1.5 w-1/2 rounded-full" style={{ backgroundColor: `hsl(${theme.ink})` }} />
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        {name || "Nama toko"}, warna {theme.label}, {open ? "menerima pesanan" : "belum dibuka"}.
      </figcaption>
    </figure>
  );
}
