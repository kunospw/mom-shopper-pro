import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useForm, useFieldArray } from 'react-hook-form';
import { UserProfileForm, UserProfile } from '@/types/user';
import { Upload, Save, LogOut, User, Building, CreditCard, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { BrandingSettings } from "@/components/BrandingSettings";
import { toast } from 'sonner';

export const Profile = () => {
  const { user, signOut, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting } } = useForm<UserProfileForm>({
    defaultValues: {
      businessAccent: user?.businessAccent || "teal",
      businessLogo: user?.businessLogo || "",
      displayName: user?.displayName || '',
      businessName: user?.businessName || '',
      businessAddress: user?.businessAddress || '',
      businessPhone: user?.businessPhone || '',
      bankAccounts: user?.bankAccounts || [{ id: '1', bankName: '', accountNumber: '', accountHolder: '' }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bankAccounts',
  });

  const onSubmit = async (data: UserProfileForm) => {
    try {
      let qrisImageBase64 = user?.qrisImageBase64;

      // Convert QRIS image to base64 if a new one is selected
      if (data.qrisImage && data.qrisImage.length > 0) {
        setUploading(true);
        const file = data.qrisImage[0];

        // Convert file to base64
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          qrisImageBase64 = base64;
          toast.success('QRIS berhasil diupload');
        } catch (error) {
          console.error('Error converting file to base64:', error);
          toast.error('Gagal mengupload QRIS');
          setUploading(false);
          return;
        }
      }

      // Prepare update data, filtering out undefined values
      const updateData: Partial<UserProfile> = {
        businessAccent: data.businessAccent,
        businessLogo: data.businessLogo,
        displayName: data.displayName,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        bankAccounts: data.bankAccounts.filter(account =>
          account.bankName || account.accountNumber || account.accountHolder
        ),
      };

      // Only add qrisImageBase64 if it's not undefined
      if (qrisImageBase64 !== undefined) {
        updateData.qrisImageBase64 = qrisImageBase64;
      }

      await updateUserProfile(updateData);

    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.size, file.type);

      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => {
        setQrisPreview(e.target?.result as string);
        console.log('Preview set successfully');
      };
      reader.onerror = (e) => {
        console.error('Error reading file for preview:', e);
      };
      reader.readAsDataURL(file);

      // Set the file in form - use setValue to update the form
      setValue('qrisImage', event.target.files as FileList);
      console.log('File set in form');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><Link to="/" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Kembali ke transaksi</Link><h1 className="text-2xl font-semibold tracking-tight">Pengaturan bisnis</h1><p className="mt-2 text-sm text-muted-foreground">Identitas, informasi akun, dan detail pembayaran.</p></div>
          <Button variant="outline" onClick={handleSignOut}><LogOut className="h-4 w-4" />Keluar</Button>
        </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        <BrandingSettings onBusyChange={setLogoReading} name={watch("businessName")} logo={watch("businessLogo")} accent={watch("businessAccent")} onLogoChange={value => setValue("businessLogo", value, { shouldDirty: true })} onAccentChange={value => setValue("businessAccent", value, { shouldDirty: true })} />
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
                  {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 text-center sm:text-left">
                <p className="font-medium text-sm sm:text-base">{user.email}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Masuk dengan Google
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="displayName" className="text-base font-semibold text-foreground">Nama Lengkap</Label>
              <Input
                id="displayName"
                {...register('displayName', { required: 'Nama lengkap wajib diisi' })}
                placeholder="Masukkan nama lengkap"
                className="text-base h-12 border border-border"
              />
              {errors.displayName && (
                <p className="text-sm text-destructive font-semibold">{errors.displayName.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

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
              <Label htmlFor="businessName" className="text-base font-semibold text-foreground">Nama Bisnis</Label>
              <Input
                id="businessName"
                {...register('businessName')}
                placeholder="Nama toko/bisnis Anda"
                className="text-base h-12 border border-border"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="businessAddress" className="text-base font-semibold text-foreground">Alamat Bisnis</Label>
              <Textarea
                id="businessAddress"
                {...register('businessAddress')}
                placeholder="Alamat lengkap bisnis"
                rows={4}
                className="text-base resize-none border border-border"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="businessPhone" className="text-base font-semibold text-foreground">Nomor Telepon Bisnis</Label>
              <Input
                id="businessPhone"
                {...register('businessPhone')}
                placeholder="Nomor telepon yang bisa dihubungi"
                className="text-base h-12 border border-border"
                type="tel"
              />
            </div>
          </CardContent>
        </Card>

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
                <Label className="text-base font-semibold text-foreground">Rekening Bank</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => append({ id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' })}
                  className="w-full sm:w-auto h-12 text-base border border-border font-semibold"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  <span>Tambah Rekening</span>
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="border border-border rounded-xl p-4 sm:p-5 space-y-4 bg-muted/40">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base text-foreground">Rekening {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive hover:bg-red-50 h-10 w-10 p-0 border border-red-300"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor={`bankAccounts.${index}.bankName`} className="text-base font-semibold text-foreground">Nama Bank</Label>
                      <Input
                        {...register(`bankAccounts.${index}.bankName` as const)}
                        placeholder="Contoh: Bank BCA"
                        className="text-base h-12 border border-border"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor={`bankAccounts.${index}.accountNumber`} className="text-base font-semibold text-foreground">Nomor Rekening</Label>
                      <Input
                        {...register(`bankAccounts.${index}.accountNumber` as const)}
                        placeholder="Nomor rekening"
                        className="text-base h-12 border border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor={`bankAccounts.${index}.accountHolder`} className="text-base font-semibold text-foreground">Nama Pemilik Rekening</Label>
                    <Input
                      {...register(`bankAccounts.${index}.accountHolder` as const)}
                      placeholder="Nama sesuai rekening bank"
                      className="text-base h-12 border border-border"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold text-foreground">QRIS Image</Label>
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
                    accept="image/*"
                    onChange={handleFileSelect}
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
                    <span>{user.qrisImageBase64 ? 'Ganti QRIS' : 'Upload QRIS'}</span>
                  </Button>
                  <p className="text-sm text-muted-foreground font-semibold">
                    Upload gambar QRIS untuk pembayaran digital
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button - Mobile Optimized */}
        <Card className="border border-border shadow-sm bg-muted/40">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-base sm:text-lg text-foreground">Simpan Perubahan</h3>
                <p className="text-sm sm:text-base text-muted-foreground font-semibold">
                  Pastikan semua informasi sudah benar sebelum menyimpan
                </p>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || uploading || logoReading}
                size="lg"
                className="w-full sm:w-auto sm:min-w-[160px] h-12 text-base"
              >
                <Save className="h-5 w-5 mr-2" />
                <span>{isSubmitting || uploading ? 'Menyimpan...' : 'Simpan pengaturan'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      </div>
    </div>
  );
};
