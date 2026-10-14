import { useState, useRef } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Loader2,
} from "lucide-react";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { BrandingSettings } from "@/components/BrandingSettings";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { settingsSections } from "@/lib/navigation";
import {
  profileFormDefaults,
  settingsFields,
  settingsChanged,
  settingsPatch,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
const sectionIcons = {
  appearance: Monitor,
  business: Building,
  payments: CreditCard,
  account: User,
};

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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Pengaturan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih bagian yang ingin Anda sesuaikan.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          aria-label="Bagian pengaturan"
          className="grid grid-cols-2 gap-2 lg:sticky lg:top-24 lg:flex lg:flex-col"
        >
          {settingsSections.map((item) => {
            const Icon = sectionIcons[item.id];
            return (
              <NavLink
                key={item.id}
                to={`/settings/${item.id}`}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-12 min-w-0 items-center gap-3 rounded-lg border px-3 py-3 text-sm hover:bg-muted",
                    isActive
                      ? "border-primary/30 bg-primary/10 font-medium text-primary"
                      : "border-transparent text-muted-foreground",
                  )
                }
              >
                <Icon className="hidden h-4 w-4 shrink-0 lg:block" />
                <span className="min-w-0 break-words">{item.label}</span>
                {dirty(item.id) && (
                  <span
                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary"
                    aria-label="Perubahan belum disimpan"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
        <section
          className="min-w-0 space-y-4"
          aria-labelledby="settings-section-title"
        >
          <div>
            <h2 id="settings-section-title" className="text-xl font-semibold">
              {section.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
          </div>
          {section.id === "appearance" ? (
            <AppearanceSettings />
          ) : (
            <form onSubmit={saveSection} className="space-y-4">
              <fieldset
                disabled={saving || signingOut}
                className="min-w-0 space-y-4"
              >
                {section.id === "business" && (
                  <>
                    <BrandingSettings
                      onBusyChange={setLogoReading}
                      name={values.businessName}
                      logo={values.businessLogo}
                      accent={values.businessAccent}
                      onLogoChange={(value) => setValue("businessLogo", value)}
                      onAccentChange={(value) =>
                        setValue("businessAccent", value)
                      }
                    />
                    {/* Business Information */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                          <Building className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                          Informasi Bisnis
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Detail bisnis yang akan tampil di invoice
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <Label
                            htmlFor="businessName"
                            className="text-base font-semibold text-foreground"
                          >
                            Nama Bisnis
                          </Label>
                          <Input
                            id="businessName"
                            {...register("businessName")}
                            placeholder="Nama toko/bisnis Anda"
                            className="text-base h-12 border border-border"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="businessAddress"
                            className="text-base font-semibold text-foreground"
                          >
                            Alamat Bisnis
                          </Label>
                          <Textarea
                            id="businessAddress"
                            {...register("businessAddress")}
                            placeholder="Alamat lengkap bisnis"
                            rows={4}
                            className="text-base resize-none border border-border"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="businessPhone"
                            className="text-base font-semibold text-foreground"
                          >
                            Nomor Telepon Bisnis
                          </Label>
                          <Input
                            id="businessPhone"
                            {...register("businessPhone")}
                            placeholder="Nomor telepon yang bisa dihubungi"
                            className="text-base h-12 border border-border"
                            type="tel"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {section.id === "account" && (
                  <>
                    {/* Personal Information */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                          Informasi Pribadi
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Informasi dasar akun Anda
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Mobile-Friendly Avatar Section */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                            <AvatarImage src={user.photoURL} />
                            <AvatarFallback className="text-base sm:text-lg">
                              {user.displayName?.charAt(0)?.toUpperCase() ||
                                "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1 text-center sm:text-left">
                            <p className="font-medium text-sm sm:text-base">
                              {user.email}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Masuk dengan Google
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="displayName"
                            className="text-base font-semibold text-foreground"
                          >
                            Nama Lengkap
                          </Label>
                          <Input
                            id="displayName"
                            {...register("displayName", {
                              validate: (value) =>
                                !!value.trim() || "Nama lengkap wajib diisi",
                            })}
                            placeholder="Masukkan nama lengkap"
                            className="text-base h-12 border border-border"
                          />
                          {errors.displayName && (
                            <p className="text-sm text-destructive font-semibold">
                              {errors.displayName.message}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
                {section.id === "payments" && (
                  <>
                    {/* Payment Information */}
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                          <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                          Informasi Pembayaran
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Detail rekening dan QRIS untuk invoice
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Bank Accounts */}
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <Label className="text-base font-semibold text-foreground">
                              Rekening Bank
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="default"
                              onClick={() =>
                                append({
                                  id: Date.now().toString(),
                                  bankName: "",
                                  accountNumber: "",
                                  accountHolder: "",
                                })
                              }
                              className="w-full sm:w-auto h-12 text-base border border-border font-semibold"
                            >
                              <Plus className="h-5 w-5 mr-2" />
                              <span>Tambah Rekening</span>
                            </Button>
                          </div>

                          {fields.map((field, index) => (
                            <div
                              key={field.id}
                              className="border border-border rounded-xl p-4 sm:p-5 space-y-4 bg-muted/40"
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-base text-foreground">
                                  Rekening {index + 1}
                                </h4>
                                {fields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Hapus rekening ${index + 1}`}
                                    onClick={() => remove(index)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 w-10 p-0 border border-destructive/30"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <Label
                                    htmlFor={`bankAccounts.${index}.bankName`}
                                    className="text-base font-semibold text-foreground"
                                  >
                                    Nama Bank
                                  </Label>
                                  <Input
                                    id={`bankAccounts.${index}.bankName`}
                                    {...register(
                                      `bankAccounts.${index}.bankName` as const,
                                    )}
                                    placeholder="Contoh: Bank BCA"
                                    className="text-base h-12 border border-border"
                                  />
                                </div>

                                <div className="space-y-3">
                                  <Label
                                    htmlFor={`bankAccounts.${index}.accountNumber`}
                                    className="text-base font-semibold text-foreground"
                                  >
                                    Nomor Rekening
                                  </Label>
                                  <Input
                                    id={`bankAccounts.${index}.accountNumber`}
                                    {...register(
                                      `bankAccounts.${index}.accountNumber` as const,
                                    )}
                                    placeholder="Nomor rekening"
                                    className="text-base h-12 border border-border"
                                  />
                                </div>
                              </div>

                              <div className="space-y-3">
                                <Label
                                  htmlFor={`bankAccounts.${index}.accountHolder`}
                                  className="text-base font-semibold text-foreground"
                                >
                                  Nama Pemilik Rekening
                                </Label>
                                <Input
                                  id={`bankAccounts.${index}.accountHolder`}
                                  {...register(
                                    `bankAccounts.${index}.accountHolder` as const,
                                  )}
                                  placeholder="Nama sesuai rekening bank"
                                  className="text-base h-12 border border-border"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <Label className="text-base font-semibold text-foreground">
                            QRIS
                          </Label>
                          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                            {/* Current QRIS or Preview */}
                            <div className="flex-shrink-0">
                              {qrisPreview || user.qrisImageBase64 ? (
                                <div className="border border-dashed border-border rounded-xl p-3">
                                  <img
                                    src={qrisPreview || user.qrisImageBase64}
                                    alt="QRIS Code"
                                    className="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-lg"
                                  />
                                </div>
                              ) : (
                                <div className="w-28 h-28 sm:w-36 sm:h-36 border border-dashed border-border rounded-xl flex items-center justify-center bg-muted/40">
                                  <p className="text-sm text-muted-foreground text-center px-2 font-semibold">
                                    Belum ada QRIS
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Upload Button */}
                            <div className="space-y-3 text-center sm:text-left w-full sm:w-auto">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => {
                                  void handleFileSelect(event);
                                }}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full sm:w-auto h-12 text-base border border-border font-semibold"
                                size="default"
                              >
                                <Upload className="h-5 w-5 mr-2" />
                                <span>
                                  {user.qrisImageBase64
                                    ? "Ganti QRIS"
                                    : "Upload QRIS"}
                                </span>
                              </Button>
                              <p className="text-sm text-muted-foreground font-semibold">
                                PNG, JPG, atau WebP, maksimal 300 KB. Gambar
                                tampil di invoice setelah disimpan.
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </fieldset>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur",
                  (dirty(section.id) || saving) &&
                    "sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10",
                )}
              >
                <p
                  role="status"
                  className="sr-only text-sm text-muted-foreground sm:not-sr-only"
                >
                  {saving
                    ? "Menyimpan perubahan…"
                    : dirty(section.id)
                      ? "Ada perubahan belum disimpan"
                      : "Tidak ada perubahan yang perlu disimpan"}
                </p>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={
                    !dirty(section.id) || saving || uploading || logoReading
                  }
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {saving
                    ? "Menyimpan…"
                    : `Simpan ${section.label.toLowerCase()}`}
                </Button>
              </div>
              {section.id === "account" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sesi akun</CardTitle>
                    <CardDescription>
                      Keluar dari akun pada perangkat ini.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={signingOut || saving}
                      onClick={() => setSignOutOpen(true)}
                    >
                      <LogOut />
                      Keluar dari akun
                    </Button>
                  </CardContent>
                </Card>
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
