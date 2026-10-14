import { useMemo, useState } from "react";
import { Transaction } from "@/types/transaction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRupiah } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, ShoppingBag, Calendar, ArrowUpDown } from "lucide-react";

interface MonthlyRecapProps {
  transactions: Transaction[];
}

type DateRangePreset = 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'all-time' | 'custom';

export const MonthlyRecap = ({ transactions }: MonthlyRecapProps) => {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (dateRangePreset) {
      case 'this-month':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        };
      case 'last-3-months':
        return {
          start: new Date(currentYear, currentMonth - 2, 1),
          end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        };
      case 'last-6-months':
        return {
          start: new Date(currentYear, currentMonth - 5, 1),
          end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        };
      case 'this-year':
        return {
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 11, 31, 23, 59, 59)
        };
      case 'all-time':
        return {
          start: new Date(2020, 0, 1), // Arbitrary early date
          end: new Date(2030, 11, 31, 23, 59, 59) // Arbitrary future date
        };
      case 'custom':
        return {
          start: startDate ? new Date(startDate) : new Date(currentYear, currentMonth, 1),
          end: endDate ? new Date(endDate + 'T23:59:59') : new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        };
      default:
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        };
    }
  };

  const stats = useMemo(() => {
    const { start, end } = getDateRange();

    const filteredTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return t.type === "sale" && date >= start && date <= end;
    });

    const totalSales = filteredTransactions.reduce((sum, t) => sum + (t.totalSellingPrice || 0), 0);
    const totalCapital = filteredTransactions.reduce((sum, t) => sum + (t.totalBasePrice || 0), 0);
    const totalProfit = filteredTransactions.reduce((sum, t) => sum + (t.totalProfit || 0), 0);

    return {
      totalSales,
      totalCapital,
      totalProfit,
      transactionCount: filteredTransactions.length,
      dateRange: { start, end }
    };
  }, [transactions, dateRangePreset, startDate, endDate]);

  const chartData = useMemo(() => {
    const { start, end } = getDateRange();
    const filteredTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return t.type === "sale" && date >= start && date <= end;
    });

    const data: { [key: string]: { sales: number; profit: number; capital: number } } = {};

    // Determine grouping based on date range
    const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const groupByMonth = daysDifference > 90; // Group by month if more than 3 months

    filteredTransactions.forEach((t) => {
      const date = new Date(t.date);
      const key = groupByMonth 
        ? `${date.toLocaleDateString("id-ID", { month: "short" })} ${date.getFullYear()}`
        : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

      if (!data[key]) {
        data[key] = { sales: 0, profit: 0, capital: 0 };
      }

      data[key].sales += t.totalSellingPrice || 0;
      data[key].profit += t.totalProfit || 0;
      data[key].capital += t.totalBasePrice || 0;
    });

    const sortedData = Object.entries(data)
      .map(([period, values]) => ({
        period,
        ...values,
      }))
      .sort((a, b) => {
        // Sort chronologically
        if (groupByMonth) {
          const [monthA, yearA] = a.period.split(' ');
          const [monthB, yearB] = b.period.split(' ');
          const monthsId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          return (parseInt(yearA) - parseInt(yearB)) || (monthsId.indexOf(monthA) - monthsId.indexOf(monthB));
        }
        return a.period.localeCompare(b.period);
      });

    return sortedData;
  }, [transactions, dateRangePreset, startDate, endDate]);

  const getPeriodTitle = () => {
    const { start, end } = stats.dateRange;
    switch (dateRangePreset) {
      case 'this-month':
        return start.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      case 'last-3-months':
        return "3 Bulan Terakhir";
      case 'last-6-months':
        return "6 Bulan Terakhir";
      case 'this-year':
        return `Tahun ${start.getFullYear()}`;
      case 'all-time':
        return "Semua Waktu";
      case 'custom':
        return `${start.toLocaleDateString("id-ID")} - ${end.toLocaleDateString("id-ID")}`;
      default:
        return "Laporan Penjualan";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-foreground">Laporan Penjualan</h2>
        <p className="text-lg text-muted-foreground font-semibold">{getPeriodTitle()}</p>
      </div>

      {/* Date Range Selection */}
      <Card className="border border-border shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5" />
            Pilih Periode Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Button
              variant={dateRangePreset === 'this-month' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('this-month')}
              className="text-sm"
            >
              Bulan Ini
            </Button>
            <Button
              variant={dateRangePreset === 'last-3-months' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('last-3-months')}
              className="text-sm"
            >
              3 Bulan
            </Button>
            <Button
              variant={dateRangePreset === 'last-6-months' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('last-6-months')}
              className="text-sm"
            >
              6 Bulan
            </Button>
            <Button
              variant={dateRangePreset === 'this-year' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('this-year')}
              className="text-sm"
            >
              Tahun Ini
            </Button>
            <Button
              variant={dateRangePreset === 'all-time' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('all-time')}
              className="text-sm"
            >
              Semua Waktu
            </Button>
            <Button
              variant={dateRangePreset === 'custom' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('custom')}
              className="text-sm"
            >
              Custom
            </Button>
          </div>

          {dateRangePreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-muted/40 rounded-lg">
              <div>
                <Label htmlFor="startDate" className="text-sm font-medium">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-sm font-medium">Tanggal Akhir</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card className="border border-border shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base text-muted-foreground font-semibold mb-1">Total Penjualan</p>
                <p className="break-words text-2xl font-semibold text-primary">{formatRupiah(stats.totalSales)}</p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{stats.transactionCount} transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base text-muted-foreground font-semibold mb-1">Total Modal</p>
                <p className="break-words text-2xl font-semibold text-primary">{formatRupiah(stats.totalCapital)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="p-4 bg-success/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base text-muted-foreground font-semibold mb-1">Total Keuntungan</p>
                <p className="break-words text-2xl font-semibold text-success">{formatRupiah(stats.totalProfit)}</p>
                {stats.totalCapital > 0 && (
                  <p className="text-sm text-success font-medium mt-2">
                    ROI: {((stats.totalProfit / stats.totalCapital) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Insights */}
      {stats.transactionCount > 0 && (
        <Card className="border border-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArrowUpDown className="h-5 w-5" />
              Ringkasan Analisis
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="break-words text-2xl font-semibold text-primary">
                {formatRupiah(Math.round(stats.totalSales / stats.transactionCount))}
              </p>
              <p className="text-sm text-muted-foreground font-medium">Rata-rata per Transaksi</p>
            </div>
            <div className="text-center">
              <p className="break-words text-2xl font-semibold text-primary">
                {formatRupiah(Math.round(stats.totalProfit / stats.transactionCount))}
              </p>
              <p className="text-sm text-muted-foreground font-medium">Rata-rata Keuntungan</p>
            </div>
            <div className="text-center">
              <p className="break-words text-2xl font-semibold text-primary">
                {stats.totalCapital > 0 ? `${((stats.totalProfit / stats.totalCapital) * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">Return on Investment</p>
            </div>
            <div className="text-center">
              <p className="break-words text-2xl font-semibold text-primary">
                {stats.totalSales > 0 ? `${((stats.totalProfit / stats.totalSales) * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-sm text-muted-foreground font-medium">Margin Keuntungan</p>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="border border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex flex-wrap items-center gap-2">
              Grafik Penjualan
              <span className="text-sm text-muted-foreground font-normal">
                ({chartData.length} periode)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: "0.75rem", fill: "hsl(var(--muted-foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: "0.75rem", fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  formatter={(value: number, name: string) => [
                    formatRupiah(value),
                    name === 'profit' ? 'Keuntungan' : 
                    name === 'sales' ? 'Penjualan' : 'Modal'
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "0.875rem",
                    fontWeight: "normal",
                  }}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} name="sales" />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="profit" />
                <Bar dataKey="capital" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="capital" />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mt-4 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Penjualan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Keuntungan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span>Modal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {chartData.length === 0 && (
        <Card className="border border-border shadow-md">
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Tidak ada data penjualan</p>
              <p className="text-sm mt-2">Belum ada transaksi pada periode yang dipilih</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
