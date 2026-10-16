import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Expense, Sale } from "@/types/books";

type Preset = "this-month" | "last-3-months" | "last-6-months" | "this-year" | "all-time" | "custom";
const presets: { id: Preset; label: string }[] = [
  { id: "this-month", label: "Bulan ini" },
  { id: "last-3-months", label: "3 bulan" },
  { id: "last-6-months", label: "6 bulan" },
  { id: "this-year", label: "Tahun ini" },
  { id: "all-time", label: "Semua" },
  { id: "custom", label: "Atur tanggal" },
];

function rangeFor(preset: Preset, startDate: string, endDate: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59);
  switch (preset) {
    case "last-3-months":
      return { start: new Date(y, m - 2, 1), end: endOfMonth };
    case "last-6-months":
      return { start: new Date(y, m - 5, 1), end: endOfMonth };
    case "this-year":
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
    case "all-time":
      return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) };
    case "custom":
      return {
        start: startDate ? new Date(startDate) : new Date(y, m, 1),
        end: endDate ? new Date(`${endDate}T23:59:59`) : endOfMonth,
      };
    default:
      return { start: new Date(y, m, 1), end: endOfMonth };
  }
}

const compact = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}jt` : value >= 1000 ? `${Math.round(value / 1000)}rb` : String(value);

export const MonthlyRecap = ({ sales, expenses }: { sales: Sale[]; expenses: Expense[] }) => {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const report = useMemo(() => {
    const { start, end } = rangeFor(preset, startDate, endDate);
    const within = (iso: string) => {
      const d = new Date(iso);
      return d >= start && d <= end;
    };
    // Cancelled sales never happened.
    const live = sales.filter((s) => s.fulfillment.status !== "cancelled");
    const inRange = live.filter((s) => within(s.date));
    const total = inRange.reduce((n, s) => n + s.total, 0);
    const cost = inRange.reduce((n, s) => n + s.cost, 0);
    const gross = inRange.reduce((n, s) => n + s.profit, 0);
    const spent = expenses.filter((e) => within(e.date)).reduce((n, e) => n + e.amount, 0);
    const received = live.flatMap((s) => s.payments).filter((p) => within(p.date)).reduce((n, p) => n + p.amount, 0);
    const owed = inRange.reduce((n, s) => n + s.balance, 0);

    const longRange = (end.getTime() - start.getTime()) / 86_400_000 > 90;
    const buckets = new Map<string, { key: string; label: string; sales: number; profit: number }>();
    for (const s of inRange) {
      const d = new Date(s.date);
      const key = longRange
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : s.date.slice(0, 10);
      const label = longRange
        ? d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const bucket = buckets.get(key) ?? { key, label, sales: 0, profit: 0 };
      bucket.sales += s.total;
      bucket.profit += s.profit;
      buckets.set(key, bucket);
    }
    const chart = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));

    const products = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const s of inRange)
      for (const item of s.items) {
        const row = products.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
        row.quantity += item.quantity;
        row.revenue += item.unitPrice * item.quantity;
        products.set(item.name, row);
      }
    const top = [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return { count: inRange.length, total, cost, spent, received, owed, net: gross - spent, chart, top };
  }, [sales, expenses, preset, startDate, endDate]);

  const margin = report.total > 0 ? (report.net / report.total) * 100 : 0;
  const secondary = [
    { label: "Uang diterima", value: formatRupiah(report.received) },
    { label: "Belum dibayar", value: formatRupiah(report.owed) },
    { label: "Modal barang", value: formatRupiah(report.cost) },
    { label: "Biaya usaha", value: formatRupiah(report.spent) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div role="group" aria-label="Periode laporan" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:px-0">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-10",
                preset === p.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Dari tanggal</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Sampai tanggal</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <section aria-label="Ringkasan periode" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="col-span-2 border-primary/30 bg-primary/5 sm:col-span-1">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Laba bersih</p>
            <p className="num break-words text-2xl font-semibold text-primary">{formatRupiah(report.net)}</p>
            <p className="text-xs text-muted-foreground">
              Margin {margin.toFixed(1)}% · setelah modal dan biaya usaha
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Penjualan</p>
            <p className="num break-words text-xl font-semibold">{formatRupiah(report.total)}</p>
            <p className="text-xs text-muted-foreground">{report.count} penjualan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Rata-rata per penjualan</p>
            <p className="num break-words text-xl font-semibold">
              {formatRupiah(report.count ? Math.round(report.total / report.count) : 0)}
            </p>
          </CardContent>
        </Card>
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-4">
        {secondary.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="num mt-0.5 break-words text-sm font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>

      {report.chart.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Belum ada penjualan pada periode ini. Coba pilih periode yang lebih panjang.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Penjualan dan keuntungan</CardTitle>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label={`Grafik penjualan dan keuntungan, ${report.chart.length} periode`}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={report.chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compact} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      formatter={(value: number, name: string) => [formatRupiah(value), name === "profit" ? "Keuntungan" : "Penjualan"]}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }}
                    />
                    <Bar dataKey="sales" name="sales" fill="hsl(var(--primary) / 0.35)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" name="profit" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/35" aria-hidden="true" />Penjualan</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />Keuntungan</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produk terlaris</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {report.top.map((row, i) => (
                  <li key={row.name} className="flex items-center gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">{row.quantity} terjual</span>
                    </span>
                    <span className="num font-semibold">{formatRupiah(row.revenue)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
