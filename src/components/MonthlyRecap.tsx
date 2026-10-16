import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, BarChart3, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { field } from "@/components/form-parts";
import { compactRupiah } from "@/components/Beranda";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Expense, Purchase, Sale } from "@/types/books";
import { derive } from "@/lib/books";
import { buildReport } from "@/lib/report";
import { customRange, inRange, periodRange, previousRange, type DateRange, type Preset as PeriodPreset } from "@/lib/period";

type Preset = "this-month" | "last-month" | "last-3-months" | "last-6-months" | "this-year" | "all-time" | "custom";
const presets: { id: Preset; label: string }[] = [
  { id: "this-month", label: "Bulan ini" },
  { id: "last-month", label: "Bulan lalu" },
  { id: "last-3-months", label: "3 bulan" },
  { id: "last-6-months", label: "6 bulan" },
  { id: "this-year", label: "Tahun ini" },
  { id: "all-time", label: "Semua" },
  { id: "custom", label: "Atur tanggal" },
];
function rangeFor(preset: Preset, from: string, to: string): DateRange {
  if (preset === "custom") return customRange(from, to) ?? periodRange("this-month");
  return periodRange(preset as PeriodPreset);
}
const axisRupiah = (value: number) => (value === 0 ? "0" : compactRupiah(value).replace("Rp ", ""));
const SALES = "#A3B8A0";
const SALES_NOW = "#819579";

function Delta({ now, before, running }: { now: number; before?: number; running?: boolean }) {
  if (before === undefined || before <= 0) return null;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[13px]">
      <span className={cn("inline-flex items-center font-semibold", up ? "text-success" : "text-destructive")}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {Math.abs(change)}%
      </span>
      <span className="text-muted-foreground">{running ? "dari periode lalu, hari yang sama" : "dari periode sebelumnya"}</span>
    </span>
  );
}

function Kpi({ label, value, children, tone, highlight }: { label: string; value: string; children?: React.ReactNode; tone?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-4 shadow-card sm:px-5", highlight && "border-primary/30 bg-primary-soft/60 dark:bg-primary/10")}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl", tone)}>{value}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Laporan: period picker, KPIs, chart, profit breakdown, top products and customers. All numbers from buildReport. */
export const MonthlyRecap = ({ sales, purchases, expenses }: { sales: Sale[]; purchases: Purchase[]; expenses: Expense[] }) => {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const data = useMemo(() => {
    const ledger = { sales, purchases, expenses };
    const range = rangeFor(preset, startDate, endDate);
    const r = buildReport(ledger, range);
    // A period still running is compared with the same number of days of the previous one.
    const now = new Date();
    const prevFull = previousRange(range);
    const running = !range.all && range.end > now && range.start < now;
    const prevRange =
      prevFull && running
        ? { start: prevFull.start, end: new Date(Math.min(prevFull.end.getTime(), prevFull.start.getTime() + (now.getTime() - range.start.getTime()))) }
        : prevFull;
    const prev = prevRange ? buildReport(ledger, prevRange) : undefined;
    const products = new Map<string, { name: string; quantity: number; revenue: number }>();
    const customers = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const raw of sales) {
      const s = derive(raw);
      if (s.fulfillment.status === "cancelled" || !inRange(s.date, range)) continue;
      for (const item of s.items) {
        const row = products.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
        row.quantity += item.quantity;
        row.revenue += item.unitPrice * item.quantity;
        products.set(item.name, row);
      }
      const name = s.customer.name.trim() || "Pelanggan";
      const key = s.customerId || name.toLowerCase();
      const c = customers.get(key) ?? { name, orders: 0, revenue: 0 };
      c.orders += 1;
      c.revenue += s.total;
      customers.set(key, c);
    }
    const daily = r.buckets.length > 0 && r.buckets[0].end.getTime() - r.buckets[0].start.getTime() <= 2 * 86_400_000;
    const chart = r.buckets.map((b, i, all) => ({
      label: daily ? b.start.toLocaleDateString("id-ID", { day: "numeric" }) : b.start.toLocaleDateString("id-ID", { month: "short", ...(all.length > 12 ? { year: "2-digit" } : {}) }),
      full: b.label,
      revenue: b.revenue,
      profit: b.netProfit,
      current: i === all.length - 1,
    }));
    return {
      r,
      prev,
      running,
      chart,
      top: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      buyers: [...customers.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  }, [sales, purchases, expenses, preset, startDate, endDate]);
  const { r, prev } = data;
  const margin = r.revenue > 0 ? (r.netProfit / r.revenue) * 100 : 0;
  const empty = r.salesCount === 0 && r.operatingCosts === 0 && r.purchaseSpend === 0;
  const breakdown: { label: string; value: number; sign?: "-" | "="; hint?: string; strong?: boolean }[] = [
    { label: "Penjualan", value: r.revenueGross, hint: `${r.salesCount} penjualan` },
    ...(r.returns ? [{ label: "Pengembalian dana", value: r.returns, sign: "-" as const }] : []),
    { label: "Modal barang terjual", value: r.cogs, sign: "-", hint: "Dari modal per produk saat dijual" },
    { label: "Laba kotor", value: r.grossProfit, sign: "=", strong: true },
    { label: "Biaya transaksi", value: r.fees, sign: "-", hint: "Biaya lain di penjualan" },
    { label: "Biaya usaha", value: r.expenses, sign: "-", hint: "Ongkir, kemasan, iklan, admin" },
    { label: "Ongkir pembelian", value: r.purchaseShipping, sign: "-" },
    { label: "Keuntungan bersih", value: r.netProfit, sign: "=", strong: true },
  ];
  const topMax = Math.max(1, ...data.top.map((t) => t.revenue));

  return (
    <div className="space-y-5">
      <div>
        <div role="group" aria-label="Periode laporan" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:inline-flex sm:rounded-xl sm:bg-muted sm:p-1">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:rounded-[9px]",
                preset === p.id ? "bg-foreground font-semibold text-background sm:bg-card sm:text-foreground sm:shadow-sm" : "border border-input text-muted-foreground hover:text-foreground sm:border-0",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Dari tanggal</Label>
              <input id="startDate" type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Sampai tanggal</Label>
              <input id="endDate" type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
        <p className="mt-2 text-[13px] text-muted-foreground" role="status">
          {r.range.all ? "Semua catatan" : `${r.range.start.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} – ${new Date(r.range.end.getTime() - 1).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
        </p>
      </div>

      <section aria-label="Ringkasan periode" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Penjualan" value={formatRupiah(r.revenue)}>
          <Delta now={r.revenue} before={prev?.revenue} running={data.running} />
          {!prev?.revenue && `${r.salesCount} penjualan`}
        </Kpi>
        <Kpi label="Keuntungan bersih" value={formatRupiah(r.netProfit)} tone={r.netProfit < 0 ? "text-destructive" : "text-primary-ink dark:text-primary"} highlight>
          Margin {margin.toFixed(1)}%
        </Kpi>
        <Kpi label="Uang diterima" value={formatRupiah(r.cashNet)}>Pembayaran masuk dikurangi pengembalian</Kpi>
        <Kpi label="Belum dibayar" value={formatRupiah(r.outstandingNow)} tone={r.outstandingNow ? "text-request" : undefined}>
          {r.customersOwing ? `${r.customersOwing} pelanggan · saat ini` : "Semua lunas"}
        </Kpi>
      </section>

      {empty ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <BarChart3 className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          Belum ada catatan pada periode ini. Pilih periode lain atau <Link to="/sales?new=1" className="font-semibold text-primary hover:underline">catat penjualan</Link>.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="flex min-w-0 flex-col p-5">
              <figure className="flex flex-1 flex-col gap-2">
                <figcaption className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold">Penjualan &amp; keuntungan bersih</span>
                  <span className="flex items-center gap-4 text-[13px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SALES }} aria-hidden="true" />Penjualan</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />Keuntungan bersih</span>
                  </span>
                </figcaption>
                <div className="min-h-[260px] flex-1" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chart} barGap={3} barCategoryGap="24%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={axisRupiah} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload as (typeof data.chart)[number];
                          return (
                            <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-pop">
                              <p className="font-semibold">{row.full}</p>
                              <p>Penjualan <strong className="num">{compactRupiah(row.revenue)}</strong></p>
                              <p>Untung <strong className="num">{compactRupiah(row.profit)}</strong></p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                        {data.chart.map((row) => <Cell key={row.full} fill={row.current ? SALES_NOW : SALES} />)}
                      </Bar>
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                        {data.chart.map((row) => <Cell key={row.full} className={row.current ? "fill-primary-ink dark:fill-primary" : "fill-primary dark:fill-primary/70"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="sr-only">
                  <table>
                    <caption>Penjualan dan keuntungan bersih per periode</caption>
                    <thead><tr><th>Periode</th><th>Penjualan</th><th>Keuntungan bersih</th></tr></thead>
                    <tbody>
                      {data.chart.map((row) => (
                        <tr key={row.full}><td>{row.full}</td><td>{formatRupiah(row.revenue)}</td><td>{formatRupiah(row.profit)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </figure>
            </Card>

            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Rincian keuntungan</h2>
              <dl className="mt-3 text-sm">
                {breakdown.map((row) => (
                  <div key={row.label} className={cn("flex items-start justify-between gap-3 py-2", row.sign === "=" && "border-t", row.strong && "font-semibold")}>
                    <dt className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="w-3 text-muted-foreground">{row.sign === "-" ? "−" : row.sign === "=" ? "=" : ""}</span>
                        {row.label}
                      </span>
                      {row.hint && <span className="ml-[18px] block text-xs font-normal text-muted-foreground">{row.hint}</span>}
                    </dt>
                    <dd className={cn("num shrink-0", row.label === "Keuntungan bersih" && (row.value < 0 ? "text-destructive" : "text-primary-ink dark:text-primary"))}>
                      {row.sign === "-" && row.value ? "−" : ""}
                      {formatRupiah(row.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 flex gap-2 rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Belanja stok periode ini {formatRupiah(r.purchaseGoods)} tidak langsung dikurangkan; modalnya dihitung saat barang terjual.
                </span>
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Produk terlaris</h2>
              {data.top.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada produk terjual pada periode ini.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {data.top.map((row, i) => (
                    <li key={row.name} className="text-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{row.name}</span>
                          <span className="block text-xs text-muted-foreground">{row.quantity} terjual</span>
                        </span>
                        <span className="num font-semibold">{formatRupiah(row.revenue)}</span>
                      </div>
                      <div className="ml-10 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(row.revenue / topMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Pelanggan teratas</h2>
              {data.buyers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>
              ) : (
                <ol className="mt-3 divide-y">
                  {data.buyers.map((row, i) => (
                    <li key={`${row.name}-${i}`} className="flex items-center gap-3 py-2.5 text-sm first:pt-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink dark:bg-primary/15 dark:text-primary">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="block text-xs text-muted-foreground">{row.orders} penjualan</span>
                      </span>
                      <span className="num font-semibold">{formatRupiah(row.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <Link to="/customers" className="mt-3 inline-block text-[13px] font-semibold text-primary hover:underline">Lihat semua pelanggan →</Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
