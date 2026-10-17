import { useState, useRef } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useForm, useFieldArray } from "react-hook-form";
import type { UserProfileForm } from "@/types/user";
import {
  Upload,
  Save,
  LogOut,
  User,
  Building,
  CreditCard,
  Plus,
  Trash2,
  Monitor,
  Sparkles,
  Loader2,
} from "lucide-react";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { AppSettings } from "@/components/AppInstall";
import { BrandingSettings } from "@/components/BrandingSettings";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { settingsSections } from "@/lib/navigation";
import { PlanSettings } from "@/components/PlanSettings";
import {
  profileFormDefaults,
  settingsFields,
  settingsChanged,
  settingsPatch,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { field } from "@/components/form-parts";
import { toast } from "sonner";
const sectionIcons = {
  appearance: Monitor,
  business: Building,
  payments: CreditCard,
  plan: Sparkles,
  account: User,
};

function Panel({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const Profile = () => {
  const { user, signOut, updateUserProfile } = useAuth();
  const { section: sectionParam } = useParams();
  const section = settingsSections.find((item) => item.id === sectionParam);
  const [baseline, setBaseline] = useState(() => profileFormDefaults(user));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const [qrisDirty, setQrisDirty] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    getValues,
    trigger,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<UserProfileForm>({ defaultValues: baseline });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "bankAccounts",
  });
  const values = watch();
  const dirty = (id: (typeof settingsSections)[number]["id"]) =>
    settingsChanged(id, values, baseline) || (id === "payments" && qrisDirty);
  const anyDirty = settingsSections.some((item) => dirty(item.id));
  const blocker = useUnsavedChanges(
    anyDirty || saving || uploading || logoReading,
    "/settings",
  );

  async function saveSection(event: React.FormEvent) {
    event.preventDefault();
    if (
      !section ||
      section.id === "appearance" ||
      section.id === "plan" ||
      saving ||
      uploading ||
      logoReading
    )
      return;
    const fieldsToValidate = [...settingsFields[section.id]];
    if (!(await trigger(fieldsToValidate, { shouldFocus: true }))) return;
    const snapshot = getValues();
    const patch = settingsPatch(section.id, snapshot);
    if (section.id === "payments" && qrisDirty)
      patch.qrisImageBase64 = qrisPreview;
    setSaving(true);
    try {
      await updateUserProfile(patch);
      const savedValues = { ...snapshot, ...patch };
      // Keep drafts in the other sections; only mark the saved section as clean.
      setBaseline((previous) => {
        const next = { ...previous };
        for (const key of settingsFields[section.id])
          Object.assign(next, { [key]: savedValues[key] });
        return next;
      });
      reset(savedValues);
      if (section.id === "payments") setQrisDirty(false);
    } catch {
      /* AuthContext reports the failed write. Keep the draft for retry. */
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 300 * 1024
    ) {
      toast.error("Pilih PNG, JPG, atau WebP maksimal 300 KB.");
      return;
    }
    setUploading(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = result;
      });
      setQrisPreview(result);
      setQrisDirty(true);
    } catch {
      toast.error("Gambar tidak dapat dibaca. Pilih file lain.");
    } finally {
      setUploading(false);
    }
  }
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }
  if (!section) return <Navigate to="/settings/appearance" replace />;

  return (
    <>
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tampilan, identitas bisnis di invoice, pembayaran, langganan, dan akun.</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Bagian pengaturan" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:bg-card lg:p-2 lg:shadow-card">
          {settingsSections.map((item) => {
            const Icon = sectionIcons[item.id];
            return (
              <NavLink
                key={item.id}
                to={`/settings/${item.id}`}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-11 shrink-0 items-center gap-3 rounded-full border px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring lg:rounded-xl lg:border-0 lg:px-3 lg:py-2.5",
                    isActive ? "border-foreground bg-foreground font-semibold text-background lg:bg-primary-soft lg:text-primary-ink dark:lg:bg-primary/15 dark:lg:text-primary" : "border-input hover:bg-accent lg:text-muted-foreground lg:hover:text-foreground",
                  )
                }
              >
                <Icon className="hidden h-[18px] w-[18px] shrink-0 lg:block" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="hidden text-xs font-normal text-muted-foreground lg:block">{item.description}</span>
                </span>
                {dirty(item.id) && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-request" aria-label="Perubahan belum disimpan" />
                )}
              </NavLink>
            );
          })}
        </nav>
        <section className="min-w-0 space-y-4" aria-labelledby="settings-section-title">
          <div>
            <h2 id="settings-section-title" className="text-xl font-semibold">{section.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </div>
          {section.id === "appearance" ? (
            <>
              <AppSettings />
              <AppearanceSettings />
            </>
          ) : section.id === "plan" ? (
            <PlanSettings />
          ) : (
            <form onSubmit={saveSection} className="space-y-4" noValidate>
              <fieldset disabled={saving || signingOut} className="min-w-0 space-y-4">
                {section.id === "business" && (
                  <>
                    <BrandingSettings
                      onBusyChange={setLogoReading}
                      name={values.businessName}
                      logo={values.businessLogo}
                      accent={values.businessAccent}
                      onLogoChange={(value) => setValue("businessLogo", value)}
                      onAccentChange={(value) => setValue("businessAccent", value)}
                    />
                    <Panel title="Informasi bisnis" description="Tampil di kepala invoice. Katalog publik punya pengaturan sendiri di Katalog → Atur toko.">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="businessName">Nama bisnis</Label>
                          <input id="businessName" className={field} {...register("businessName")} placeholder="Nama toko atau bisnis Anda" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="businessAddress">Alamat bisnis</Label>
                          <Textarea id="businessAddress" {...register("businessAddress")} placeholder="Alamat lengkap bisnis" rows={3} className="resize-none" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="businessPhone">Nomor telepon bisnis</Label>
                          <input id="businessPhone" className={field} {...register("businessPhone")} placeholder="0812 3456 7890" type="tel" />
                        </div>
                      </div>
                    </Panel>
                  </>
                )}
                {section.id === "account" && (
                  <Panel title="Informasi pribadi" description="Nama Anda di ruang usaha. Email mengikuti akun Google.">
                    <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-3">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback className="text-base">{user.displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.email}</p>
                        <p className="text-sm text-muted-foreground">Masuk dengan Google</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor="displayName">Nama lengkap</Label>
                      <input
                        id="displayName"
                        className={field}
                        aria-invalid={!!errors.displayName || undefined}
                        {...register("displayName", { validate: (value) => !!value.trim() || "Nama lengkap wajib diisi" })}
                        placeholder="Masukkan nama lengkap"
                      />
                      {errors.displayName && <p className="text-sm font-medium text-destructive">{errors.displayName.message}</p>}
                    </div>
                  </Panel>
                )}
                {section.id === "payments" && (
                  <>
                    <Panel
                      title="Rekening bank"
                      description="Tampil di invoice supaya pembeli tahu ke mana harus membayar."
                      action={
                        <Button type="button" variant="outline" onClick={() => append({ id: Date.now().toString(), bankName: "", accountNumber: "", accountHolder: "" })}>
                          <Plus /> Tambah rekening
                        </Button>
                      }
                    >
                      {fields.length === 0 ? (
                        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Belum ada rekening. Tambahkan minimal satu agar muncul di invoice.</p>
                      ) : (
                        <ul className="space-y-3">
                          {fields.map((item, index) => (
                            <li key={item.id} className="rounded-xl border p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">Rekening {index + 1}</p>
                                {fields.length > 1 && (
                                  <Button type="button" variant="ghost" size="icon" aria-label={`Hapus rekening ${index + 1}`} onClick={() => remove(index)} className="h-10 w-10 text-muted-foreground hover:text-destructive">
                                    <Trash2 />
                                  </Button>
                                )}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`bankAccounts.${index}.bankName`}>Nama bank</Label>
                                  <input id={`bankAccounts.${index}.bankName`} className={field} {...register(`bankAccounts.${index}.bankName` as const)} placeholder="Contoh: BCA" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`bankAccounts.${index}.accountNumber`}>Nomor rekening</Label>
                                  <input id={`bankAccounts.${index}.accountNumber`} className={cn(field, "num")} inputMode="numeric" {...register(`bankAccounts.${index}.accountNumber` as const)} placeholder="Nomor rekening" />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                  <Label htmlFor={`bankAccounts.${index}.accountHolder`}>Nama pemilik rekening</Label>
                                  <input id={`bankAccounts.${index}.accountHolder`} className={field} {...register(`bankAccounts.${index}.accountHolder` as const)} placeholder="Nama sesuai buku tabungan" />
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>
                    <Panel title="QRIS" description="Gambar QRIS tampil di invoice setelah disimpan.">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        {qrisPreview || user.qrisImageBase64 ? (
                          <img src={qrisPreview || user.qrisImageBase64} alt="Kode QRIS" className="h-36 w-36 shrink-0 rounded-xl border object-cover" />
                        ) : (
                          <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/40 px-3 text-center text-sm text-muted-foreground">Belum ada QRIS</div>
                        )}
                        <div className="space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            aria-label="Pilih gambar QRIS"
                            onChange={(event) => {
                              void handleFileSelect(event);
                            }}
                            className="sr-only"
                            tabIndex={-1}
                          />
                          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                            {qrisPreview || user.qrisImageBase64 ? "Ganti QRIS" : "Unggah QRIS"}
                          </Button>
                          <p className="text-xs text-muted-foreground">PNG, JPG, atau WebP, maksimal 300 KB.</p>
                        </div>
                      </div>
                    </Panel>
                  </>
                )}
              </fieldset>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-card backdrop-blur",
                  (dirty(section.id) || saving) && "sticky bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-10 lg:bottom-4",
                )}
              >
                <p role="status" className="sr-only text-sm text-muted-foreground sm:not-sr-only">
                  {saving ? "Menyimpan perubahan…" : dirty(section.id) ? "Ada perubahan belum disimpan" : "Tidak ada perubahan yang perlu disimpan"}
                </p>
                <Button type="submit" className="h-11 w-full rounded-[10px] sm:w-auto" disabled={!dirty(section.id) || saving || uploading || logoReading}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {saving ? "Menyimpan…" : `Simpan ${section.label.toLowerCase()}`}
                </Button>
              </div>
              {section.id === "account" && (
                <Panel title="Sesi akun" description="Keluar dari akun pada perangkat ini. Data Anda tetap tersimpan.">
                  <Button type="button" variant="outline" disabled={signingOut || saving} onClick={() => setSignOutOpen(true)}>
                    <LogOut />
                    Keluar dari akun
                  </Button>
                </Panel>
              )}
            </form>
          )}
        </section>
      </div>
      <UnsavedChangesDialog blocker={blocker} />
      <AlertDialog
        open={signOutOpen}
        onOpenChange={(open) => {
          if (!signingOut) setSignOutOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari akun?</AlertDialogTitle>
            <AlertDialogDescription>
              {anyDirty
                ? "Ada perubahan yang belum disimpan. Perubahan tersebut akan hilang jika Anda keluar."
                : "Anda dapat masuk kembali menggunakan akun Google yang sama."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
            >
              {signingOut ? "Keluar…" : "Keluar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
