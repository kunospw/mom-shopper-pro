import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Clock, Inbox, X } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import { rejectOrder } from "@/lib/orders-owner-storage";
import { optionPrice, orderCode, type CatalogProduct, type Order } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const DAY = 86_400_000;
function ago(iso: string) {
  if (!iso) return "baru saja";
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 1) return "baru saja";
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function problems(order: Order, products: CatalogProduct[] | null) {
  if (!products) return [];
  const out: string[] = [];
  for (const item of order.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.published) out.push(`${item.name} tidak lagi ditampilkan`);
    else if (product.availability === "unavailable") out.push(`${item.name} sedang tidak tersedia`);
    else if (optionPrice(product, item.option) !== item.unitPrice)
      out.push(`Harga ${item.name} sekarang ${formatRupiah(optionPrice(product, item.option))}`);
  }
  return out;
}

function OrderCard({
  order,
  products,
  onReject,
}: {
  order: Order;
  products: CatalogProduct[] | null;
  onReject?: (order: Order) => void;
}) {
  const issues = order.status === "pending" ? problems(order, products) : [];
  const stale = order.status === "pending" && order.createdAt && Date.now() - new Date(order.createdAt).getTime() > 3 * DAY;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {order.buyerName} <span className="text-sm font-normal text-muted-foreground">#{orderCode(order.id)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{ago(order.createdAt)}</p>
          </div>
          <p className="num text-lg font-semibold">{formatRupiah(order.subtotal)}</p>
        </div>
        <ul className="space-y-1 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">
                {item.quantity}× {item.name}
                {item.option ? ` · ${item.option}` : ""}
                {item.kind === "digital" ? " (digital)" : item.availability === "preorder" ? ` (PO ${item.leadTime})` : ""}
              </span>
              <span className="num shrink-0 text-muted-foreground">{formatRupiah(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="rounded-lg bg-muted/60 p-2 text-sm">“{order.note}”</p>}
        {issues.length > 0 && (
          <div role="note" className="flex gap-2 rounded-lg border border-pending/30 bg-pending/10 p-3 text-sm text-pending">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Cek sebelum konfirmasi</p>
              <ul>{issues.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        )}
        {stale && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Sudah lebih dari 3 hari. Hubungi pembeli atau tolak pesanan ini.
          </p>
        )}
        {order.status === "pending" ? (
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link to={`/sales?confirm=${order.id}`}><Check /> Konfirmasi</Link>
            </Button>
            <Button variant="outline" onClick={() => onReject?.(order)}><X /> Tolak</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={order.status === "confirmed" ? "success" : "danger"}>
              {order.status === "confirmed" ? "Dikonfirmasi" : "Ditolak"}
            </Badge>
            {order.sellerNote && <span className="text-xs text-muted-foreground">{order.sellerNote}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Orders() {
  const books = useBooks();
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOwnerCatalog().then((c) => setProducts(c.products)).catch(() => setProducts(null));
  }, []);
  const lists = useMemo(
    () => ({
      pending: books.orders.filter((o) => o.status === "pending"),
      confirmed: books.orders.filter((o) => o.status === "confirmed"),
      rejected: books.orders.filter((o) => o.status === "rejected"),
    }),
    [books.orders],
  );

  async function confirmReject() {
    if (!rejecting) return;
    setBusy(true);
    setError("");
    try {
      await rejectOrder(rejecting.id, reason);
      await books.reload();
      toast.success(`Pesanan #${orderCode(rejecting.id)} ditolak`);
      setRejecting(null);
      setReason("");
    } catch {
      setError("Pesanan belum ditolak. Periksa koneksi, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const empty = (text: string) => (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        {text}
      </CardContent>
    </Card>
  );

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Pesanan masuk</h1>
        <p className="text-sm text-muted-foreground">
          Pesanan dari katalog Anda. Pesanan baru tercatat sebagai penjualan hanya setelah Anda konfirmasi.
        </p>
      </header>
      {books.loading ? (
        <div role="status" aria-label="Memuat pesanan" className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
            <TabsTrigger value="pending">Baru ({lists.pending.length})</TabsTrigger>
            <TabsTrigger value="confirmed">Dikonfirmasi</TabsTrigger>
            <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-3">
            {lists.pending.length
              ? lists.pending.map((o) => <OrderCard key={o.id} order={o} products={products} onReject={setRejecting} />)
              : empty("Belum ada pesanan baru. Bagikan tautan toko Anda agar pembeli bisa memesan.")}
          </TabsContent>
          <TabsContent value="confirmed" className="space-y-3">
            {lists.confirmed.length
              ? lists.confirmed.map((o) => <OrderCard key={o.id} order={o} products={products} />)
              : empty("Belum ada pesanan yang dikonfirmasi.")}
          </TabsContent>
          <TabsContent value="rejected" className="space-y-3">
            {lists.rejected.length
              ? lists.rejected.map((o) => <OrderCard key={o.id} order={o} products={products} />)
              : empty("Tidak ada pesanan yang ditolak.")}
          </TabsContent>
        </Tabs>
      )}
      <AlertDialog open={!!rejecting} onOpenChange={(open) => !open && !busy && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak pesanan {rejecting ? `#${orderCode(rejecting.id)}` : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pesanan tidak menjadi penjualan dan pembeli melihat statusnya ditolak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Alasan untuk pembeli (opsional)</Label>
            <Textarea id="reject-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: stok habis" />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Kembali</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmReject()}>
              {busy ? "Menolak…" : "Tolak pesanan"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
