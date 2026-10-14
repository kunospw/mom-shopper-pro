import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  Chrome,
  Building,
  Loader2,
  BarChart3,
  Receipt,
  ShoppingCart,
} from "lucide-react";

export const Login = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ""}`
    : "/";

  useEffect(() => {
    // Redirect if already logged in
    if (user && !loading) {
      navigate(destination, { replace: true });
    }
  }, [user, loading, navigate, destination]);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      // Error handling is done in AuthContext, just log for debugging
      if (
        code !== "auth/popup-closed-by-user" &&
        code !== "auth/cancelled-popup-request"
      ) {
        console.error("Login failed:", error);
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-2 md:items-center">
        <section>
          <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building className="h-6 w-6" />
          </div>
          <p className="mb-3 text-sm font-medium text-primary">Ruang Usaha</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Kelola usaha Anda.
          </h1>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Ruang kerja sederhana untuk penjualan, pembayaran pelanggan, dan
            pembelian stok.
          </p>
          <div className="mt-8 space-y-4">
            {[
              {
                icon: ShoppingCart,
                text: "Catat penjualan dan pembelian stok",
              },
              { icon: Receipt, text: "Buat dan bagikan invoice" },
              { icon: BarChart3, text: "Pantau pembayaran dan laporan" },
            ].map((feature) => (
              <div
                key={feature.text}
                className="flex items-center gap-3 text-sm"
              >
                <feature.icon className="h-5 w-5 text-primary" />
                {feature.text}
              </div>
            ))}
          </div>
        </section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Selamat datang</CardTitle>
            <CardDescription>
              Masuk ke ruang kerja bisnis Anda dengan akun Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              onClick={handleGoogleSignIn}
              className="min-h-12 w-full"
              disabled={loading || signingIn}
            >
              {signingIn ? <Loader2 className="animate-spin" /> : <Chrome />}
              {signingIn ? "Sedang masuk…" : "Masuk dengan Google"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Gunakan akun yang sama untuk mengakses catatan bisnis Anda.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
