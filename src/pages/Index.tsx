import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Plus,
  ReceiptText,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { MonthlyRecap } from "@/components/MonthlyRecap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/currency";
import { fulfillmentLabels, paymentLabels, summarizeBooks } from "@/lib/books";

const Index = () => {
  const { pathname } = useLocation();
  const books = useBooks();
  const isOverview = pathname === "/";
  const summary = summarizeBooks(books.sales, books.purchases, books.expenses);
  const open = books.sales.filter(
    (s) => s.fulfillment.status !== "cancelled",
  );
  const owed = open.filter((s) => s.balance > 0);
  const toShip = open.filter((s) =>
    ["confirmed", "packed"].includes(s.fulfillment.status),
  );

  const metrics = [
    { label: "Penjualan tercatat", value: summary.sales, description: "Semua pesanan, termasuk yang belum lunas", icon: TrendingUp, path: "/sales" },
    { label: "Uang diterima", value: summary.received, description: "DP dan pelunasan yang sudah masuk", icon: CheckCircle, path: "/sales?pay=paid" },
    { label: "Belum dibayar", value: summary.receivable, description: "Sisa tagihan dari pelanggan", icon: Clock, path: "/sales?pay=unpaid" },
    { label: "Laba bersih", value: summary.netProfit, description: "Untung penjualan dikurangi biaya usaha", icon: Wallet, path: "/reports" },
  ];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isOverview ? "Ringkasan" : "Laporan"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOverview
              ? "Lihat kondisi usaha dan tentukan langkah berikutnya."
              : "Tinjau penjualan, modal, biaya, dan laba bersih menurut periode."}
          </p>
        </div>
      </header>
      {books.loading ? (
        <div role="status" aria-label="Memuat catatan usaha" className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-44" />
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
          <section aria-label="Ringkasan seluruh periode" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Link key={metric.label} to={metric.path} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                    <metric.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="break-words text-xl font-semibold sm:text-2xl">{formatRupiah(metric.value)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{metric.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>
          <p className="text-xs text-muted-foreground">Seluruh periode · Pesanan yang dibatalkan tidak dihitung.</p>
          <section aria-labelledby="quick-actions-title" className="space-y-3">
            <h2 id="quick-actions-title" className="text-lg font-semibold">Apa yang ingin Anda catat?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { path: "/sales?new=1", label: "Catat penjualan", description: "Pesanan, DP, dan pengiriman pelanggan", icon: Plus },
                { path: "/costs", label: "Catat pembelian atau biaya", description: "Belanja stok, ongkir, kemasan, iklan", icon: ReceiptText },
              ].map((action) => (
                <Button key={action.path} asChild variant="outline" className="h-auto justify-start whitespace-normal p-4">
                  <Link to={action.path}>
                    <action.icon className="mr-2 shrink-0" />
                    <span className="min-w-0 text-left">
                      <span className="block font-medium">{action.label}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">{action.description}</span>
                    </span>
                    <ArrowRight className="ml-auto shrink-0" />
                  </Link>
                </Button>
              ))}
            </div>
          </section>
          <section className="space-y-3" aria-labelledby="todo-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="todo-title" className="text-lg font-semibold">Perlu ditindaklanjuti</h2>
              <Button asChild variant="ghost"><Link to="/sales">Lihat semua<ArrowRight /></Link></Button>
            </div>
            {owed.length === 0 && toShip.length === 0 ? (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">Semua pesanan sudah lunas dan terkirim.</CardContent></Card>
            ) : (
              <ul className="space-y-2">
                {[...owed.slice(0, 3).map((s) => ({ s, tag: paymentLabels[s.paymentState], extra: `Sisa ${formatRupiah(s.balance)}`, key: `o-${s.id}`, icon: Clock })),
                  ...toShip.slice(0, 3).map((s) => ({ s, tag: fulfillmentLabels[s.fulfillment.status], extra: "Siap diproses", key: `t-${s.id}`, icon: Truck }))].map(({ s, tag, extra, key, icon: Icon }) => (
                  <li key={key}>
                    <Link to={`/sales?view=${s.id}`} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                      <Card className="transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center justify-between gap-3 p-4">
                          <span className="flex min-w-0 items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{s.customer.name}</span>
                              <span className="block text-xs text-muted-foreground">{s.number} · {tag}</span>
                            </span>
                          </span>
                          <span className="text-sm font-medium">{extra}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <MonthlyRecap sales={books.sales} expenses={books.expenses} />
      )}
    </>
  );
};
export default Index;
