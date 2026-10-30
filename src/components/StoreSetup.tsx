import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, MessageCircle, MessagesSquare, Package, Palette, PartyPopper, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AccentPicker, LogoPicker, OrderChoicesFields, ShopHeaderPreview, ShopProfileFields, SlugField, WhatsAppField } from "@/components/StoreFields";
import { useSlugCheck } from "@/hooks/use-slug-check";
import { buyerPaymentLabels, deliveryLabels, emptyProfile, profileProblem, storefrontSchema, type Storefront, type StorefrontFields } from "@/lib/catalog";
import { accents, effectiveAccentKey } from "@/lib/branding";
import { shopUrl } from "@/lib/shop-link";
import { descriptionIdeas, formatWhatsApp, suggestSlug, toWhatsApp, whatsAppPattern } from "@/lib/store-setup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const steps = [
  { id: "name", label: "Nama", title: "Beri nama toko Anda", hint: "Nama ini tampil di katalog dan di pesan WhatsApp dari pembeli." },
  { id: "whatsapp", label: "WhatsApp", title: "Ke mana pesanan dikirim?", hint: "Pembeli mengirim pesanan ke nomor WhatsApp ini, jadi pakai nomor yang aktif." },
  { id: "orders", label: "Pesanan", title: "Bagaimana pembeli menerima dan membayar?", hint: "Pilihan yang dicentang muncul saat pembeli memesan. Bisa diubah kapan saja." },
  { id: "profile", label: "Info", title: "Ceritakan toko Anda", hint: "Asisten otomatis memakai jawaban ini untuk menjawab pembeli. Pembeli juga bisa membacanya, jadi jangan isi data pribadi." },
  { id: "look", label: "Tampilan", title: "Atur tampilan toko", hint: "Semuanya opsional dan bisa diubah kapan saja." },
  { id: "open", label: "Buka", title: "Periksa lalu buka toko", hint: "Begini toko Anda terlihat oleh pembeli." },
] as const;

type Stage = "intro" | 0 | 1 | 2 | 3 | 4 | 5 | "done";

/**
 * First-time shop setup: one question per screen, a live preview, then open.
 * Used when the owner has no storefront yet; later edits use StorefrontEditor.
 */
export function StoreSetup({
  initial,
  trialLocked = false,
  trialStarts = false,
  onUpgrade,
  checkSlug,
  onSave,
  onFinish,
  onDirtyChange,
  onBusyChange,
}: {
  initial: StorefrontFields;
  trialLocked?: boolean;
  trialStarts?: boolean;
  onUpgrade?: () => void;
  checkSlug: (slug: string) => Promise<boolean>;
  onSave: (value: StorefrontFields) => Promise<Storefront>;
  /** Close the setup; "product" continues to the first product. */
  onFinish: (next: "product" | "close") => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [draft, setDraft] = useState<StorefrontFields>(() => ({
    ...initial,
    accent: effectiveAccentKey(initial.accent),
    slug: initial.slug || suggestSlug(initial.name),
    profile: initial.profile ?? emptyProfile,
  }));
  const [slugTouched, setSlugTouched] = useState(false);
  const [showSlug, setShowSlug] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Storefront | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const slug = useSlugCheck(draft.slug, "", checkSlug);

  useEffect(() => {
    if (stage !== "intro") heading.current?.focus();
  }, [stage]);

  function change<K extends keyof StorefrontFields>(key: K, value: StorefrontFields[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
    onDirtyChange(true);
  }
  function changeName(name: string) {
    setDraft((previous) => ({ ...previous, name, slug: slugTouched ? previous.slug : suggestSlug(name) }));
    setError("");
    onDirtyChange(true);
  }

  const name = draft.name.trim();
  const number = toWhatsApp(draft.whatsapp);
  function stepError(index: number) {
    if (index === 0) {
      if (name.length < 2) return "Isi nama toko, minimal 2 huruf.";
      if (!draft.slug) return "Isi tautan toko.";
      if (slug.state === "invalid" || slug.state === "taken") return slug.hint;
    }
    if (index === 1 && !whatsAppPattern.test(number)) return "Nomor belum lengkap. Contoh: 0812 3456 7890.";
    if (index === 2 && !draft.payments?.length) return "Pilih minimal satu cara pembayaran.";
    if (index === 3) return profileProblem(draft.profile);
    return "";
  }

  function next() {
    if (typeof stage !== "number") return;
    const problem = stepError(stage);
    if (problem) {
      setError(problem);
      if (stage === 0 && name.length >= 2) setShowSlug(true);
      return;
    }
    if (stage === 0 && slug.state === "checking") return;
    setError("");
    if (stage < 5) setStage((stage + 1) as Stage);
  }
  function back() {
    setError("");
    if (stage === 0) setStage("intro");
    else if (typeof stage === "number") setStage((stage - 1) as Stage);
  }

  async function save(published: boolean) {
    if (saving) return;
    const first = [0, 1, 2, 3].find((index) => stepError(index));
    if (first !== undefined) {
      setStage(first as Stage);
      setError(stepError(first));
      return;
    }
    const parsed = storefrontSchema.safeParse({ ...draft, name, whatsapp: number, published });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError("");
    try {
      const store = await onSave(parsed.data);
      setSaved(store);
      onDirtyChange(false);
      setStage("done");
    } catch (failure) {
      const reason = failure instanceof Error ? failure.name : "";
      if (reason === "SlugTakenError") {
        setStage(0);
        setShowSlug(true);
        setError("Tautan toko baru saja dipakai orang lain. Pilih nama lain.");
      } else {
        setError(
          reason === "TrialEndedError"
            ? "Masa uji coba berakhir, jadi katalog belum bisa dibuka. Simpan dulu, lalu buka setelah upgrade."
            : "Toko belum tersimpan. Periksa koneksi lalu coba lagi.",
        );
      }
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  if (stage === "intro")
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <div className="space-y-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary">
            <Store className="h-6 w-6" aria-hidden="true" />
          </span>
          <DialogTitle className="text-2xl">Buat toko online Anda</DialogTitle>
          <DialogDescription>
            Pembeli memilih produk dari tautan toko, lalu pesanannya masuk ke WhatsApp Anda. Siapkan dalam sekitar 3 menit.
          </DialogDescription>
        </div>
        <ol className="space-y-3">
          {[
            { Icon: Store, title: "Nama dan tautan toko", body: "Kami buatkan tautannya dari nama toko." },
            { Icon: MessageCircle, title: "Nomor WhatsApp pesanan", body: "Pesanan pembeli dikirim ke nomor ini." },
            { Icon: Truck, title: "Pengiriman dan pembayaran", body: "Pilihan yang muncul saat pembeli memesan." },
            { Icon: MessagesSquare, title: "Info toko", body: "Produk, PO, retur, dan jam balas. Dipakai asisten untuk menjawab pembeli." },
            { Icon: Palette, title: "Warna dan logo", body: "Opsional. Bisa diubah kapan saja." },
            { Icon: Package, title: "Buka toko dan tambah produk", body: trialStarts ? "Membuka toko memulai uji coba gratis 7 hari." : "Toko bisa dibuka sekarang atau nanti." },
          ].map(({ Icon, title, body }, index) => (
            <li key={title} className="flex gap-3 rounded-xl border p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Langkah {index + 1}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[13px] text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row-reverse">
          <Button type="button" size="lg" className="h-12 rounded-xl sm:flex-1" onClick={() => setStage(0)}>
            Mulai <ArrowRight />
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => onFinish("close")}>
            Nanti saja
          </Button>
        </div>
      </div>
    );

  if (stage === "done" && saved) {
    const link = shopUrl(saved);
    const open = saved.published;
    async function copy() {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Tautan toko disalin");
      } catch {
        toast.error("Tautan belum bisa disalin. Salin manual dari kolom di atas.");
      }
    }
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
            <PartyPopper className="h-7 w-7" aria-hidden="true" />
          </span>
          <DialogTitle ref={heading} tabIndex={-1} className="text-2xl outline-none">
            {open ? "Toko Anda sudah buka!" : "Toko tersimpan"}
          </DialogTitle>
          <DialogDescription>
            {open
              ? "Langkah berikutnya: tambahkan produk supaya pembeli bisa memesan."
              : "Toko belum terlihat oleh pembeli. Buka kapan saja dari Katalog → Atur toko."}
          </DialogDescription>
        </div>
        {open && (
          <div className="min-w-0 space-y-2 rounded-xl border p-3">
            <Label htmlFor="setup-link" className="text-xs text-muted-foreground">
              Tautan toko
            </Label>
            <div className="flex min-w-0 gap-2">
              <Input id="setup-link" readOnly value={link} className="min-w-0 flex-1" onFocus={(event) => event.target.select()} />
              <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Salin tautan toko" onClick={() => void copy()}>
                <Copy />
              </Button>
            </div>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row-reverse">
          <Button type="button" size="lg" className="h-12 rounded-xl sm:flex-1" onClick={() => onFinish("product")}>
            <Package /> Tambah produk pertama
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => onFinish("close")}>
            Selesai
          </Button>
        </div>
      </div>
    );
  }

  const index = stage as 0 | 1 | 2 | 3 | 4 | 5;
  const step = steps[index];
  const busyCheck = index === 0 && slug.state === "checking";
  return (
    <form
      className="flex min-w-0 flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (index < 5) next();
      }}
    >
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Langkah {index + 1} dari {steps.length}
        </p>
        <ol className="grid grid-cols-6 gap-1.5" aria-label="Langkah">
          {steps.map((item, position) => (
            <li key={item.id} aria-current={position === index ? "step" : undefined}>
              <span className={cn("block h-1.5 rounded-full", position <= index ? "bg-primary" : "bg-muted")} />
              <span className={cn("mt-1 block truncate text-[11px]", position === index ? "font-semibold" : "text-muted-foreground")}>
                {position < index && <Check className="mr-0.5 inline h-3 w-3" aria-hidden="true" />}
                {item.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="space-y-1">
          <DialogTitle ref={heading} tabIndex={-1} className="text-xl outline-none">
            {step.title}
          </DialogTitle>
          <DialogDescription>{step.hint}</DialogDescription>
        </div>
      </div>

      <fieldset disabled={saving} className="min-w-0 space-y-5">
        {index === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="store-name">Nama toko</Label>
              <Input
                id="store-name"
                maxLength={80}
                autoFocus
                autoComplete="organization"
                value={draft.name}
                onChange={(event) => changeName(event.target.value)}
                placeholder="Contoh: Toko Bunda Rina"
              />
            </div>
            {showSlug ? (
              <SlugField
                value={draft.slug}
                state={slug.state}
                hint={slug.hint}
                onChange={(value) => {
                  setSlugTouched(true);
                  change("slug", value);
                }}
              />
            ) : (
              <div className="min-w-0 rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Tautan toko Anda</p>
                <p className="mt-0.5 break-all text-sm font-semibold">
                  {window.location.host}/shop/{draft.slug || "…"}
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p role="status" className={cn("text-xs", slug.state === "taken" || slug.state === "invalid" ? "text-destructive" : "text-muted-foreground")}>
                    {!draft.slug ? "Isi nama toko dulu." : slug.state === "checking" ? "Memeriksa…" : slug.hint}
                  </p>
                  <button type="button" className="text-xs font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setShowSlug(true)}>
                    Ubah tautan
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {index === 1 && (
          <>
            <WhatsAppField value={draft.whatsapp} autoFocus onChange={(value) => change("whatsapp", value)} />
            {whatsAppPattern.test(number) && (
              <a
                href={`https://wa.me/${number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Cek nomor di WhatsApp
              </a>
            )}
          </>
        )}

        {index === 2 && (
          <div className="space-y-4">
            <OrderChoicesFields
              delivery={draft.delivery}
              payments={draft.payments}
              onDelivery={(value) => change("delivery", value)}
              onPayments={(value) => change("payments", value)}
            />
            <p className="text-xs text-muted-foreground">Hanya jual produk digital? Kosongkan pengiriman.</p>
          </div>
        )}

        {index === 3 && <ShopProfileFields value={draft.profile ?? emptyProfile} onChange={(value) => change("profile", value)} />}

        {index === 4 && (
          <>
            <AccentPicker value={effectiveAccentKey(draft.accent)} onChange={(value) => change("accent", value)} />
            <LogoPicker name={name} value={draft.logo} onChange={(value) => change("logo", value)} onBusyChange={onBusyChange} />
            <div className="space-y-2">
              <Label htmlFor="store-description">
                Tentang toko <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5" aria-label="Contoh deskripsi">
                {descriptionIdeas.map((idea) => (
                  <button
                    key={idea.label}
                    type="button"
                    className="min-h-9 rounded-full border px-3 text-xs font-medium hover:bg-muted"
                    onClick={() => change("description", idea.text)}
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
              <Textarea
                id="store-description"
                maxLength={600}
                rows={3}
                value={draft.description}
                onChange={(event) => change("description", event.target.value)}
                placeholder="Pilih contoh di atas atau tulis sendiri, misalnya produk yang dijual dan cara pemesanan."
              />
            </div>
            <ShopHeaderPreview name={name} description={draft.description} logo={draft.logo} accent={effectiveAccentKey(draft.accent)} open />
          </>
        )}

        {index === 5 && (
          <>
            <ShopHeaderPreview name={name} description={draft.description} logo={draft.logo} accent={effectiveAccentKey(draft.accent)} open={!trialLocked} />
            <dl className="divide-y rounded-xl border text-sm">
              {[
                { label: "Tautan", value: `${window.location.host}/shop/${draft.slug}`, step: 0 },
                { label: "WhatsApp", value: formatWhatsApp(number), step: 1 },
                { label: "Pengiriman", value: draft.delivery?.length ? draft.delivery.map((item) => deliveryLabels[item]).join(", ") : "Lewat chat", step: 2 },
                { label: "Pembayaran", value: (draft.payments ?? []).map((item) => buyerPaymentLabels[item]).join(", "), step: 2 },
                { label: "Sapaan", value: draft.profile?.greeting ?? "", step: 3 },
                { label: "Warna", value: accents[effectiveAccentKey(draft.accent)].label, step: 4 },
              ].map((row) => (
                  <div key={row.label} className="flex min-w-0 items-center gap-3 p-3">
                    <dt className="w-20 shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 flex-1 break-words font-medium">{row.value}</dd>
                    <button type="button" className="shrink-0 text-xs font-semibold text-primary hover:underline" onClick={() => setStage(row.step as Stage)}>
                      Ubah<span className="sr-only"> {row.label}</span>
                    </button>
                  </div>
                ))}
            </dl>
            {trialLocked ? (
              <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
                Masa uji coba sudah berakhir, jadi toko disimpan dulu tanpa dibuka.{" "}
                {onUpgrade && (
                  <button type="button" onClick={onUpgrade} className="font-semibold underline underline-offset-2">
                    Lihat paket
                  </button>
                )}
              </p>
            ) : trialStarts ? (
              <p className="rounded-xl bg-info-soft p-3 text-sm text-info">
                Membuka toko memulai <strong>uji coba gratis 7 hari</strong>. Pencatatan penjualan tetap gratis selamanya.
              </p>
            ) : null}
          </>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky -bottom-4 -mx-4 -mb-4 mt-auto flex flex-col gap-2 border-t bg-card px-4 pb-4 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
        {index < 5 ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={back}>
              <ArrowLeft /> <span className="max-sm:sr-only">Kembali</span>
            </Button>
            <Button type="submit" className="h-12 flex-1 rounded-xl" disabled={busyCheck}>
              {busyCheck ? "Memeriksa tautan…" : index === 4 ? "Lanjut ke pratinjau" : "Lanjut"} {!busyCheck && <ArrowRight />}
            </Button>
          </div>
        ) : (
          <>
            {!trialLocked && (
              <Button type="button" className="h-12 rounded-xl" disabled={saving} onClick={() => void save(true)}>
                {saving ? "Menyimpan…" : "Buka toko sekarang"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={saving} onClick={back}>
                <ArrowLeft /> <span className="max-sm:sr-only">Kembali</span>
              </Button>
              <Button type="button" variant={trialLocked ? "default" : "ghost"} className="h-11 flex-1 rounded-xl" disabled={saving} onClick={() => void save(false)}>
                {trialLocked ? (saving ? "Menyimpan…" : "Simpan toko") : "Simpan dulu, buka nanti"}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
