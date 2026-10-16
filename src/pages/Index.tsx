import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBooks } from "@/contexts/BooksContext";
import { SubscriptionNotice } from "@/components/SubscriptionNotice";
import { Beranda } from "@/components/Beranda";
import { startTrial } from "@/lib/entitlement-storage";
import { usePlan } from "@/hooks/use-plan";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { shopUrl } from "@/lib/shop-link";
import { toast } from "sonner";

const Index = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const books = useBooks();
  const { plan, reload } = usePlan();
  const [starting, setStarting] = useState(false);
  async function beginTrial() {
    setStarting(true);
    try {
      await startTrial();
      reload();
    } catch {
      toast.error("Uji coba belum bisa dimulai. Coba lagi.");
    } finally {
      setStarting(false);
    }
  }
  const isOverview = pathname === "/";
  const name = user?.businessName?.trim() || user?.displayName?.split(" ")[0] || "Pemilik usaha";
  const link = shopUrl(books.store, user?.uid);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tautan toko disalin");
    } catch {
      toast.error("Tautan belum bisa disalin. Salin manual dari kolom di bawah.");
    }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: books.store?.name || name, url: link });
      else await copy();
    } catch {
      /* Cancelled. */
    }
  }

  const body = books.loading ? (
    <div role="status" aria-label="Memuat catatan usaha" className="space-y-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
      <p className="text-sm text-muted-foreground">Memuat catatan usaha…</p>
    </div>
  ) : books.error ? (
    <Card>
      <CardContent className="space-y-3 p-6">
        <p role="alert">Catatan belum dapat dimuat. Periksa koneksi Anda.</p>
        <Button variant="outline" onClick={() => void books.reload()}>Coba lagi</Button>
      </CardContent>
    </Card>
  ) : null;

  if (isOverview)
    return (
      <>
        <SubscriptionNotice plan={plan} published={!!books.store?.published} onStart={() => void beginTrial()} starting={starting} />
        {body ?? <Beranda name={name} link={link} onShare={() => void share()} />}
      </>
    );

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Laporan</h1>
        <p className="text-sm text-muted-foreground">Tinjau penjualan, modal, biaya, dan laba bersih menurut periode.</p>
      </header>
      {body ?? <MonthlyRecap sales={books.sales} purchases={books.purchases} expenses={books.expenses} />}
    </>
  );
};
export default Index;
