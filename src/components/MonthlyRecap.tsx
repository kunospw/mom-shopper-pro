import { useMemo } from "react";
import { Transaction } from "@/types/transaction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, ShoppingBag } from "lucide-react";

interface MonthlyRecapProps {
  transactions: Transaction[];
}

export const MonthlyRecap = ({ transactions }: MonthlyRecapProps) => {
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalSales = monthlyTransactions.reduce((sum, t) => sum + t.sellingPrice, 0);
    const totalCapital = monthlyTransactions.reduce((sum, t) => sum + t.basePrice, 0);
    const totalProfit = monthlyTransactions.reduce((sum, t) => sum + t.profit, 0);

    return {
      totalSales,
      totalCapital,
      totalProfit,
      transactionCount: monthlyTransactions.length,
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    const monthlyData: { [key: string]: { sales: number; profit: number; capital: number } } = {};

    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthYear = `${date.toLocaleDateString("id-ID", { month: "short" })} ${date.getFullYear()}`;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { sales: 0, profit: 0, capital: 0 };
      }

      monthlyData[monthYear].sales += t.sellingPrice;
      monthlyData[monthYear].profit += t.profit;
      monthlyData[monthYear].capital += t.basePrice;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .slice(-6);
  }, [transactions]);

  const currentMonth = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-1">Rekap Bulanan</h2>
        <p className="text-muted-foreground">{currentMonth}</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Penjualan</p>
                <p className="text-2xl font-bold">{formatRupiah(stats.totalSales)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.transactionCount} transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent/10 rounded-full">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Modal</p>
                <p className="text-2xl font-bold">{formatRupiah(stats.totalCapital)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Keuntungan</p>
                <p className="text-2xl font-bold text-success">{formatRupiah(stats.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Grafik Penjualan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatRupiah(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="profit" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
