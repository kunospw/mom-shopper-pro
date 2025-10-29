import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, ArrowLeft, ShoppingBag } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="bg-white/80 backdrop-blur-md border-0 shadow-xl max-w-md w-full">
        <CardContent className="text-center p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag className="h-8 w-8 text-white" />
            </div>
          </div>
          
          {/* 404 Message */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Halaman Tidak Ditemukan</h2>
            <p className="text-gray-600">
              Maaf, halaman yang Anda cari tidak dapat ditemukan atau telah dipindahkan.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              asChild 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              size="lg"
            >
              <Link to="/">
                <Home className="mr-2 h-5 w-5" />
                Kembali ke Beranda
              </Link>
            </Button>
            
            <Button 
              onClick={() => window.history.back()} 
              variant="ghost" 
              className="w-full text-gray-600 hover:text-gray-900"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Kembali ke Halaman Sebelumnya
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-xs text-gray-500">
            <p>Jika Anda yakin ini adalah kesalahan, silakan hubungi dukungan.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
