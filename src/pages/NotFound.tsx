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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="bg-card backdrop-blur-md border-0 shadow-sm max-w-md w-full">
        <CardContent className="text-center p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          
          {/* 404 Message */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
            <h2 className="text-xl font-semibold text-foreground mb-2">Halaman Tidak Ditemukan</h2>
            <p className="text-muted-foreground">
              Maaf, halaman yang Anda cari tidak dapat ditemukan atau telah dipindahkan.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              asChild 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Kembali ke Halaman Sebelumnya
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-xs text-muted-foreground">
            <p>Jika Anda yakin ini adalah kesalahan, silakan hubungi dukungan.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
