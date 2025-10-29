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
import { UserProfileForm, BankAccount } from '@/types/user';
import { Upload, Save, LogOut, User, Building, CreditCard, Plus, Trash2, ArrowLeft, Home } from 'lucide-react';
import { toast } from 'sonner';

export const Profile = () => {
  const { user, signOut, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting } } = useForm<UserProfileForm>({
    defaultValues: {
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
      const updateData: any = {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Mobile-Friendly Navigation Header */}
        <div className="mb-6 sm:mb-8">
          {/* Mobile Header - Stacked Layout */}
          <div className="block sm:hidden">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm">Kembali</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold">Profil Pengguna</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Kelola informasi pribadi dan bisnis
              </p>
            </div>
            <div className="flex justify-center mt-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span className="text-sm">Dashboard</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Desktop Header - Original Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Profil Pengguna</h1>
                <p className="text-muted-foreground mt-1">
                  Kelola informasi pribadi dan bisnis Anda
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </div>
        </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* Personal Information */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
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
            
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium">Nama Lengkap</Label>
              <Input
                id="displayName"
                {...register('displayName', { required: 'Nama lengkap wajib diisi' })}
                placeholder="Masukkan nama lengkap"
                className="text-sm"
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
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
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium">Nama Bisnis</Label>
              <Input
                id="businessName"
                {...register('businessName')}
                placeholder="Nama toko/bisnis Anda"
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessAddress" className="text-sm font-medium">Alamat Bisnis</Label>
              <Textarea
                id="businessAddress"
                {...register('businessAddress')}
                placeholder="Alamat lengkap bisnis"
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessPhone" className="text-sm font-medium">Nomor Telepon Bisnis</Label>
              <Input
                id="businessPhone"
                {...register('businessPhone')}
                placeholder="Nomor telepon yang bisa dihubungi"
                className="text-sm"
                type="tel"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-md">
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
                <Label className="text-sm sm:text-base font-medium">Rekening Bank</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' })}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="text-sm">Tambah Rekening</span>
                </Button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3 sm:p-4 space-y-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Rekening {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`bankAccounts.${index}.bankName`} className="text-sm">Nama Bank</Label>
                      <Input
                        {...register(`bankAccounts.${index}.bankName` as const)}
                        placeholder="Contoh: Bank BCA"
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`bankAccounts.${index}.accountNumber`} className="text-sm">Nomor Rekening</Label>
                      <Input
                        {...register(`bankAccounts.${index}.accountNumber` as const)}
                        placeholder="Nomor rekening"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`bankAccounts.${index}.accountHolder`} className="text-sm">Nama Pemilik Rekening</Label>
                    <Input
                      {...register(`bankAccounts.${index}.accountHolder` as const)}
                      placeholder="Nama sesuai rekening bank"
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-sm">QRIS Image</Label>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Current QRIS or Preview */}
                <div className="flex-shrink-0">
                  {qrisPreview || user.qrisImageBase64 ? (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-2">
                      <img
                        src={qrisPreview || user.qrisImageBase64}
                        alt="QRIS Code"
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                      <p className="text-xs text-muted-foreground text-center px-2">
                        Belum ada QRIS
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="space-y-2 text-center sm:text-left w-full sm:w-auto">
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
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    <span className="text-sm">{user.qrisImageBase64 ? 'Ganti QRIS' : 'Upload QRIS'}</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Upload gambar QRIS untuk pembayaran digital
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button - Mobile Optimized */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-md">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-sm sm:text-base">Simpan Perubahan</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Pastikan semua informasi sudah benar sebelum menyimpan
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting || uploading} 
                size="lg" 
                className="w-full sm:w-auto sm:min-w-[140px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Save className="h-4 w-4 mr-2" />
                <span className="text-sm">{isSubmitting || uploading ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      </div>
    </div>
  );
};
