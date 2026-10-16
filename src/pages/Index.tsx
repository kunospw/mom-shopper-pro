import { Link, useLocation } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Inbox,
  Share2,
  Truck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBooks } from "@/contexts/BooksContext";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/currency";
import { fulfillmentLabels, summarizeBooks } from "@/lib/books";
import { shopUrl } from "@/lib/shop-link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const monthKey = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Delta({ now, before }: { now: number; before: number }) {
  if (!before || before < 0) return null;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-success" : "text-destructive")}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(change)}% <span className="font-normal text-muted-foreground">dari bulan lalu</span>
    </span>
  );
}

const Index = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const books = useBooks();
  const isOverview = pathname === "/";
  const thisMonth = summarizeBooks(books.sales, books.purchases, books.expenses, monthKey());
  const lastMonth = summarizeBooks(books.sales, books.purchases, books.expenses, monthKey(-1));
  const all = summarizeBooks(books.sales, books.purchases, books.expenses);
  const live = books.sales.filter((s) => s.fulfillment.status !== "cancelled");
  const owed = live.filter((s) => s.balance > 0);
  const toShip = live.filter((s) => ["confirmed", "packed"].includes(s.fulfillment.status));
  const pending = books.orders.filter((o) => o.status === "pending");
  const name = user?.businessName?.trim() || user?.displayName?.split(" ")[0] || "Pemilik usaha";
  const link = shopUrl(books.store, user?.uid);

  const actions = [
    ...(pending.length
      ? [{ key: "orders", to: "/orders", icon: Inbox, title: `${pending.length} pesanan baru`, hint: "Konfirmasi atau tolak", strong: true }]
      : []),
    ...toShip.slice(0, 4).map((s) => ({ key: `t-${s.id}`, to: `/sales?view=${s.id}`, icon: Truck, title: `${s.customer.name} · ${s.number}`, hint: fulfillmentLabels[s.fulfillment.status] + " — siap diproses", strong: false })),
    ...owed.slice(0, 4).map((s) => ({ key: `o-${s.id}`, to: `/sales?view=${s.id}`, icon: Clock, title: `${s.customer.name} · ${s.number}`, hint: `Sisa tagihan ${formatRupiah(s.balance)}`, strong: false })),
  ];

  const steps = [
    { done: !!books.store?.name, label: "Atur nama dan nomor WhatsApp toko", to: "/catalog?store=edit" },
    { done: !!books.store?.published, label: "Buka toko untuk pembeli", to: "/catalog" },
    { done: books.sales.length > 0, label: "Catat penjualan pertama", to: "/sales?new=1" },
  ];
  const onboarding = steps.some((s) => !s.done) && books.sales.length < 3;

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
      await navigator.share({ title: books.store?.name || name, url: link });
    } catch {
      /* Cancelled. */
    }
  }

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {isOverview ? `Halo, ${name}` : "Laporan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOverview
            ? new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
            : "Tinjau penjualan, modal, biaya, dan laba bersih menurut periode."}
        </p>
      </header>
      {books.loading ? (
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
      ) : isOverview ? (
        <>
          <section aria-labelledby="todo-title" className="space-y-3">
            <h2 id="todo-title" className="text-base font-semibold">Perlu tindakan</h2>
            {actions.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  Semua beres. Tidak ada pesanan baru, tagihan, atau pengiriman yang menunggu.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {actions.map(({ key, to, icon: Icon, title, hint, strong }) => (
                  <li key={key}>
                    <Link
                      to={to}
                      className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Card className={cn("transition-colors hover:border-primary/40", strong && "border-primary/40 bg-primary/5")}>
                        <CardContent className="flex items-center gap-3 p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="month-title" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="month-title" className="text-base font-semibold">Bulan ini</h2>
              <Link to="/reports" className="text-sm text-primary hover:underline">Lihat laporan</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Penjualan", value: thisMonth.sales, before: lastMonth.sales, wide: true },
                { label: "Uang diterima", value: thisMonth.received, before: lastMonth.received, wide: false },
                { label: "Laba bersih", value: thisMonth.netProfit, before: lastMonth.netProfit, wide: false },
              ].map((m) => (
                <Card key={m.label} className={cn(m.wide && "col-span-2 sm:col-span-1")}>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className={cn("num break-words font-semibold", m.wide ? "text-2xl" : "text-xl sm:text-2xl")}>{formatRupiah(m.value)}</p>
                    <Delta now={m.value} before={m.before} />
                  </CardContent>
                </Card>
              ))}
            </div>
            {all.receivable > 0 && (
              <p className="text-sm text-muted-foreground">
                Total belum dibayar pelanggan: <strong className="num text-foreground">{formatRupiah(all.receivable)}</strong>
              </p>
            )}
          </section>

          {onboarding && (
            <Card className="border-primary/30">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-base font-semibold">Mulai dalam 3 langkah</h2>
                <ol className="space-y-1">
                  {steps.map((step) => (
                    <li key={step.label}>
                      <Link
                        to={step.to}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent"
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
                        <span className="sr-only">{step.done ? "(selesai)" : "(belum)"}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <h2 className="text-base font-semibold">Bagikan toko Anda</h2>
                <p className="text-sm text-muted-foreground">
                  Tempel tautan ini di grup, status, atau bio WhatsApp. Pesanan pembeli masuk ke menu Pesanan.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  readOnly
                  aria-label="Tautan toko"
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-muted/50 px-3 text-sm md:h-10"
                />
                <Button onClick={() => void copy()}><Copy /> Salin</Button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button variant="outline" onClick={() => void share()}><Share2 /> Bagikan</Button>
                )}
                <Button asChild variant="outline">
                  <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink /> Buka</a>
                </Button>
              </div>
              {!books.store?.published && (
                <p className="text-xs text-muted-foreground">
                  Toko belum dibuka, jadi pembeli belum bisa melihatnya.{" "}
                  <Link to="/catalog" className="text-primary underline underline-offset-4">Buka di Katalog</Link>
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <MonthlyRecap sales={books.sales} expenses={books.expenses} />
      )}
    </>
  );
};
export default Index;
