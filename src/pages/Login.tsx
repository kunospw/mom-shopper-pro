import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Chrome, Building, Loader2, BarChart3, Receipt, ShoppingCart, Cloud } from 'lucide-react';

export const Login = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already logged in
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (error: any) {
      // Error handling is done in AuthContext, just log for debugging
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
        console.error('Login failed:', error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg">
        {/* Logo and Branding */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <Building className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-3">Reseller Manager App</h1>
          <p className="text-lg sm:text-xl text-gray-600 font-semibold">📋 Kelola Bisnis Reseller Anda</p>
          <p className="text-base sm:text-lg text-gray-500 mt-2 sm:mt-3 font-medium">✨ Mudah digunakan untuk semua usia</p>
        </div>

        {/* Login Card */}
        <Card className="bg-white/90 backdrop-blur-sm border-2 border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="text-center pb-6 sm:pb-8 px-4 sm:px-6">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">Selamat Datang! 👋</CardTitle>
            <CardDescription className="text-base sm:text-lg text-gray-600 leading-relaxed font-medium">
              Masuk untuk mengelola transaksi penjualan dan membuat invoice dengan mudah
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 sm:space-y-8 px-4 sm:px-6">
            <Button
              onClick={handleGoogleSignIn}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 h-12 sm:h-16 text-base sm:text-lg font-semibold"
              disabled={loading || signingIn}
            >
              {signingIn ? (
                <Loader2 className="mr-2 sm:mr-3 h-5 w-5 sm:h-7 sm:w-7 animate-spin" />
              ) : (
                <Chrome className="mr-2 sm:mr-3 h-5 w-5 sm:h-7 sm:w-7" />
              )}
              {signingIn ? 'Sedang masuk...' : 'Masuk dengan Akun Google'}
            </Button>
            
            {/* Features List */}
            <div className="pt-4 sm:pt-6 space-y-4 sm:space-y-5 bg-gray-50/80 rounded-xl p-4 sm:p-6 border-2 border-gray-200">
              <h4 className="font-bold text-gray-800 text-center mb-3 sm:mb-4 text-lg sm:text-xl">Fitur Aplikasi:</h4>
              <div className="grid gap-3 sm:gap-4">
                <div className="flex items-center text-sm sm:text-base text-gray-700 font-medium">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg mr-3 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-4 w-4 text-white" />
                  </div>
                  Catat penjualan dan stok barang
                </div>
                <div className="flex items-center text-sm sm:text-base text-gray-700 font-medium">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg mr-3 flex items-center justify-center flex-shrink-0">
                    <Receipt className="h-4 w-4 text-white" />
                  </div>
                  Buat invoice untuk pelanggan
                </div>
                <div className="flex items-center text-sm sm:text-base text-gray-700 font-medium">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg mr-3 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  Lihat laporan keuntungan
                </div>
                <div className="flex items-center text-sm sm:text-base text-gray-700 font-medium">
                  <div className="w-8 h-8 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg mr-3 flex items-center justify-center flex-shrink-0">
                    <Cloud className="h-4 w-4 text-white" />
                  </div>
                  Data tersimpan aman di cloud
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs sm:text-sm text-gray-500 pt-3 sm:pt-4 border-t border-gray-200">
              <p className="font-medium">Dengan masuk, Anda menyetujui syarat dan ketentuan kami</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
