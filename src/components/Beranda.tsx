import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Circle,
  Copy,
  HandCoins,
  Inbox,
  Info,
  MessageCircle,
  Package,
  PackagePlus,
  ReceiptText,
  Share2,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useBooks } from "@/contexts/BooksContext";
import { FulfillmentChip } from "@/components/status";
import { Card } from "@/components/ui/card";
import { buildReport, recentActivity, type ActivityItem } from "@/lib/report";
import { periodRange, previousRange, type DateRange } from "@/lib/period";
import { orderCode } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Period = "7-days" | "this-month" | "this-year";
const periods: { id: Period; label: string }[] = [
  { id: "7-days", label: "7 hari" },
  { id: "this-month", label: "Bulan ini" },
  { id: "this-year", label: "Tahun ini" },
];

/** "Rp 18,45 jt" for chart axes and the formula line. */
export function compactRupiah(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt`;
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000).toLocaleString("id-ID")} rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}
const axisRupiah = (value: number) => (value === 0 ? "0" : compactRupiah(value).replace("Rp ", ""));

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes || 1} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before || before <= 0) return null;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[13px]">
      <span className={cn("inline-flex items-center font-semibold", up ? "text-success" : "text-destructive")}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {Math.abs(change)}%
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/** Chart period: daily for "7 hari", the last six months for "Bulan ini", Jan–now for "Tahun ini". */
function chartRange(period: Period, now = new Date()): DateRange {
  if (period === "7-days") return periodRange("7-days", now);
  if (period === "this-year") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  return periodRange("last-6-months", now);
}

const SALES = "#A3B8A0";
const SALES_NOW = "#819579";

function SalesChart({ period }: { period: Period }) {
  const books = useBooks();
  const data = useMemo(() => {
    const report = buildReport({ sales: books.sales, purchases: books.purchases, expenses: books.expenses }, chartRange(period));
    return report.buckets.map((b, i, all) => ({
      label: period === "7-days" ? b.start.toLocaleDateString("id-ID", { weekday: "short" }) : b.start.toLocaleDateString("id-ID", { month: "short" }),
      full: period === "7-days" ? b.label : b.start.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      revenue: b.revenue,
      profit: b.netProfit,
      current: i === all.length - 1,
    }));
  }, [books.sales, books.purchases, books.expenses, period]);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">Penjualan &amp; keuntungan bersih</span>
        <span className="flex items-center gap-4 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SALES }} aria-hidden="true" />Penjualan</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />Keuntungan bersih</span>
          <Link to="/reports" className="font-semibold text-primary hover:underline">Lihat laporan →</Link>
        </span>
      </figcaption>
      <div className="h-[230px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={axisRupiah} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-pop">
                    <p className="font-semibold">{row.full}</p>
                    <p>Penjualan <strong className="num">{compactRupiah(row.revenue)}</strong></p>
                    <p>Untung <strong className="num">{compactRupiah(row.profit)}</strong></p>
                  </div>
                );
              }}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.full} fill={row.current ? SALES_NOW : SALES} />
              ))}
            </Bar>
            <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.full} className={row.current ? "fill-primary-ink dark:fill-primary" : "fill-primary dark:fill-primary/70"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
      <table>
        <caption>Penjualan dan keuntungan bersih per periode</caption>
        <thead><tr><th>Periode</th><th>Penjualan</th><th>Keuntungan bersih</th></tr></thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.full}><td>{row.full}</td><td>{formatRupiah(row.revenue)}</td><td>{formatRupiah(row.profit)}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

function ActionColumn({
  icon: Icon,
  tone,
  title,
  subtitle,
  count,
  children,
  footer,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle: string;
  count?: number;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", tone)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        {!!count && <span className="text-xl font-bold text-request">{count}</span>}
      </div>
      <div className="flex-1">{children}</div>
      {footer}
    </Card>
  );
}

const activityIcon: Record<ActivityItem["kind"], LucideIcon> = {
  sale: ReceiptText,
  payment: Banknote,
  refund: ArrowDownRight,
  purchase: ShoppingCart,
  expense: Wallet,
};
const activityLabel: Record<ActivityItem["kind"], string> = {
  sale: "Penjualan",
  payment: "Pembayaran",
  refund: "Pengembalian",
  purchase: "Pembelian stok",
  expense: "Biaya",
};

export function Beranda({ name, link, onShare }: { name: string; link: string; onShare: () => void }) {
  const books = useBooks();
  const [period, setPeriod] = useState<Period>("this-month");
  const ledger = { sales: books.sales, purchases: books.purchases, expenses: books.expenses };
  const range = periodRange(period);
  const report = buildReport(ledger, range);
  const before = buildReport(ledger, previousRange(range)!);
  const live = books.sales.filter((s) => s.fulfillment.status !== "cancelled");
  const owed = live.filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance);
  const toShip = live.filter((s) => ["confirmed", "packed"].includes(s.fulfillment.status));
  const pending = books.orders.filter((o) => o.status === "pending");
  const activity = recentActivity(ledger, 5);
  const operating = report.fees + report.expenses + report.purchaseShipping;
  const spend = report.purchaseGoods + operating;
  const paidShare = report.cashNet + report.outstandingNow > 0 ? (Math.max(0, report.cashNet) / (Math.max(0, report.cashNet) + report.outstandingNow)) * 100 : 0;
  const previousLabel =
    period === "this-month"
      ? `dari ${previousRange(range)!.start.toLocaleDateString("id-ID", { month: "long" })}`
      : period === "this-year"
        ? "dari tahun lalu"
        : "dari 7 hari sebelumnya";
  const steps = [
    { done: !!books.store?.name, label: "Atur nama dan nomor WhatsApp toko", to: "/catalog?store=edit" },
    { done: !!books.store?.published, label: "Buka toko untuk pembeli", to: "/catalog" },
    { done: books.sales.length > 0, label: "Catat penjualan pertama", to: "/sales?new=1" },
  ];
  const onboarding = steps.some((s) => !s.done) && books.sales.length < 3;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tautan toko disalin.");
    } catch {
      toast.error("Tautan belum bisa disalin. Salin manual dari kolom tautan.");
    }
  }
  const remind = (s: (typeof owed)[number]) =>
    s.customer.whatsapp
      ? `https://wa.me/${s.customer.whatsapp}?text=${encodeURIComponent(
          `Halo ${s.customer.name}, mengingatkan sisa tagihan ${s.number} sebesar ${formatRupiah(s.balance)}. Terima kasih.`,
        )}`
      : "";
  const [host, path] = (() => {
    const url = link.replace(/^https?:\/\//, "");
    const i = url.indexOf("/shop/");
    return i >= 0 ? [url.slice(0, i + 6), url.slice(i + 6)] : [url, ""];
  })();

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Halo, {name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {pending.length > 0 && (
              <>
                {" · ada "}
                <Link to="/orders" className="font-semibold text-request hover:underline">
                  {pending.length} permintaan pesanan
                </Link>
                {" yang menunggu Anda."}
              </>
            )}
          </p>
        </div>
        <div role="group" aria-label="Periode" className="inline-flex rounded-xl border bg-card p-1">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "h-9 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                period === p.id ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] [&>*]:min-w-0">
        <Card className="flex flex-col gap-5 p-6">
          <div className="grid gap-5 sm:grid-cols-[1.3fr_1fr_1fr] sm:divide-x">
            <div>
              <p className="text-sm text-muted-foreground">Total penjualan</p>
              <p className="num mt-1 text-[34px] font-bold leading-tight tracking-tight">{formatRupiah(report.revenue)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
                <Delta now={report.revenue} before={before.revenue} label={previousLabel} />
                <span>· {report.salesCount} penjualan</span>
              </p>
            </div>
            <div className="sm:pl-5">
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" />Pembayaran diterima</p>
              <p className="num mt-1 text-xl font-bold">{formatRupiah(report.cashNet)}</p>
              <p className="text-xs text-muted-foreground">uang yang sudah masuk</p>
            </div>
            <div className="sm:pl-5">
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-clay" aria-hidden="true" />Belum lunas</p>
              <p className="num mt-1 text-xl font-bold">{formatRupiah(report.outstandingNow)}</p>
              <p className="text-xs text-muted-foreground">dari {report.customersOwing} pelanggan</p>
            </div>
          </div>
          <div
            role="img"
            aria-label={`${Math.round(paidShare)}% sudah dibayar, sisanya belum lunas`}
            className="flex h-2 gap-1 overflow-hidden rounded-full"
          >
            <span className="rounded-full bg-primary" style={{ width: `${paidShare}%` }} />
            <span className="flex-1 rounded-full bg-clay" />
          </div>
          <SalesChart period={period} />
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-6">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Total pengeluaran</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"><Wallet className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            </div>
            <p className="num text-[26px] font-bold tracking-tight">{formatRupiah(spend)}</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Pembelian stok</dt><dd className="num font-medium">{formatRupiah(report.purchaseGoods)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Biaya usaha</dt><dd className="num font-medium">{formatRupiah(operating)}</dd></div>
            </dl>
          </Card>
          <section className="flex flex-1 flex-col gap-3 rounded-2xl bg-primary p-6 text-primary-foreground shadow-card dark:bg-primary/20 dark:text-foreground">
            <div className="flex items-center justify-between">
              <h2 className="text-sm opacity-90">Keuntungan bersih</h2>
              {before.netProfit > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  {report.netProfit >= before.netProfit ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
                  {Math.abs(Math.round(((report.netProfit - before.netProfit) / before.netProfit) * 100))}%
                  <span className="sr-only">{report.netProfit >= before.netProfit ? "naik" : "turun"} {previousLabel}</span>
                </span>
              )}
            </div>
            <p className="num text-[34px] font-bold leading-tight tracking-tight">{formatRupiah(report.netProfit)}</p>
            <p className="text-[13px] leading-relaxed opacity-90">
              Penjualan {compactRupiah(report.revenue)} − modal barang terjual {compactRupiah(report.cogs)} − biaya usaha {compactRupiah(operating)}.
            </p>
            <p className="mt-auto flex gap-2 rounded-xl bg-black/10 p-3 text-xs leading-normal opacity-90">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Dihitung dari modal barang yang terjual, bukan total belanja stok periode ini.
            </p>
          </section>
        </div>
      </div>

      {onboarding && (
        <Card className="p-5">
          <h2 className="text-base font-semibold">Mulai dalam 3 langkah</h2>
          <ol className="mt-2 grid gap-1 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.label}>
                <Link to={step.to} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent">
                  {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
                  <span className="sr-only">{step.done ? "(selesai)" : "(belum)"}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <section aria-labelledby="todo-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="todo-title" className="text-lg font-semibold">Perlu tindakan</h2>
          <p className="text-[13px] text-muted-foreground">Diurutkan dari yang paling mendesak</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
          <ActionColumn
            icon={Inbox}
            tone="bg-request-soft text-request"
            title="Permintaan baru"
            subtitle="Belum menjadi penjualan"
            count={pending.length}
            footer={
              <Link to="/orders" className="flex h-11 items-center justify-center rounded-[10px] bg-foreground text-sm font-semibold text-background hover:opacity-90">
                {pending.length ? "Tinjau & konfirmasi" : "Buka pesanan"}
              </Link>
            }
          >
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada permintaan baru dari katalog.</p>
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 3).map((o) => (
                  <li key={o.id}>
                    <Link
                      to={`/orders?id=${o.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-dashed border-request/35 bg-request-soft/40 px-3 py-2.5 hover:bg-request-soft/70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{o.buyerName}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">#{orderCode(o.id)} · {ago(o.createdAt)}</span>
                      </span>
                      <span className="num shrink-0 text-sm font-semibold">{formatRupiah(o.subtotal)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ActionColumn>
          <ActionColumn
            icon={HandCoins}
            tone="bg-warning-soft text-warning"
            title="Belum lunas"
            subtitle={`${formatRupiah(report.outstandingNow)} total piutang`}
            footer={
              <Link to="/sales?f=due" className="flex h-11 items-center justify-center rounded-[10px] border border-input text-sm font-semibold hover:bg-accent">
                Lihat semua tagihan
              </Link>
            }
          >
            {owed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua penjualan sudah lunas.</p>
            ) : (
              <ul className="divide-y">
                {owed.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <Link to={`/sales?view=${s.id}`} className="min-w-0 hover:underline">
                      <span className="block truncate text-sm font-medium">{s.customer.name || "Pelanggan"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.number} · sisa <strong className="num text-foreground">{formatRupiah(s.balance)}</strong>
                      </span>
                    </Link>
                    {remind(s) && (
                      <a
                        href={remind(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Tagih ${s.customer.name} via WhatsApp`}
                        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-success/35 px-2.5 text-[13px] font-semibold text-success hover:bg-success-soft"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Tagih
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ActionColumn>
          <ActionColumn
            icon={Package}
            tone="bg-info-soft text-info"
            title="Siap dikemas & dikirim"
            subtitle="Penjualan yang sudah dikonfirmasi"
            footer={
              <Link to="/sales?f=ship" className="flex h-11 items-center justify-center rounded-[10px] border border-input text-sm font-semibold hover:bg-accent">
                Atur pengiriman
              </Link>
            }
          >
            {toShip.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada yang menunggu dikirim.</p>
            ) : (
              <ul className="divide-y">
                {toShip.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    <Link to={`/sales?view=${s.id}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 hover:underline">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.customer.name || "Pelanggan"}</span>
                        <span className="block text-xs text-muted-foreground">{s.number} · {s.items.reduce((n, i) => n + i.quantity, 0)} item</span>
                      </span>
                      <FulfillmentChip status={s.fulfillment.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ActionColumn>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] [&>*]:min-w-0">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Transaksi terbaru</h2>
            <Link to="/sales" className="text-sm font-semibold text-primary hover:underline">Semua penjualan →</Link>
          </div>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Belum ada transaksi. Catat penjualan pertama Anda.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {activity.map((a) => {
                const Icon = activityIcon[a.kind];
                const incoming = a.amount >= 0;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", incoming ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{activityLabel[a.kind]} · {a.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                    </span>
                    <span className="hidden text-[13px] text-muted-foreground sm:block">{shortDate(a.date)}</span>
                    <span className={cn("num shrink-0 text-right text-sm font-semibold", incoming ? "text-success" : "text-foreground")}>
                      {incoming ? "+ " : "− "}
                      {formatRupiah(Math.abs(a.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <h2 className="text-[15px] font-semibold">Aksi cepat</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { icon: ReceiptText, label: "Catat penjualan", to: "/sales?new=1" },
                { icon: Wallet, label: "Catat biaya", to: "/costs?new=expense" },
                { icon: PackagePlus, label: "Tambah produk", to: "/catalog?new=product" },
                { icon: Truck, label: "Catat pembelian", to: "/costs?new=purchase" },
              ].map(({ icon: Icon, label, to }) => (
                <Link key={label} to={to} className="flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3.5 text-sm font-medium hover:bg-accent">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </Card>
          <section className="rounded-2xl bg-primary-soft p-6 dark:bg-primary/10">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Store className="h-4 w-4 text-primary-ink dark:text-primary" aria-hidden="true" />Bagikan toko Anda</h2>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <span className={cn("h-2 w-2 rounded-full", books.store?.published ? "bg-success" : "bg-muted-foreground")} aria-hidden="true" />
                {books.store?.published ? "Toko dibuka" : "Toko ditutup"}
              </span>
            </div>
            <p className="mt-3 truncate rounded-xl border bg-card px-3.5 py-3 font-mono text-[13px]">
              <span className="text-muted-foreground">{host}</span>
              <strong>{path}</strong>
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => void copy()} className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Copy className="h-4 w-4" aria-hidden="true" />
                Salin
              </button>
              <button type="button" onClick={onShare} className="flex h-11 items-center justify-center gap-2 rounded-[10px] border bg-card text-sm font-semibold hover:bg-accent">
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Bagikan
              </button>
            </div>
            {!books.store?.published && (
              <p className="mt-2.5 text-xs text-muted-foreground">
                Pembeli belum bisa melihat toko. <Link to="/catalog" className="font-semibold text-primary underline underline-offset-4">Buka di Katalog <ArrowRight className="inline h-3 w-3" aria-hidden="true" /></Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
