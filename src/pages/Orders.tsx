import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CircleX, Clock, Inbox, Info, MessageCircle, MessageSquareQuote, ReceiptText, ShoppingBag, TriangleAlert, X } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { getOwnerCatalog } from "@/lib/catalog-owner-storage";
import { rejectOrder } from "@/lib/orders-owner-storage";
import { MAX_ORDER_LINES, availabilityLabels, buyerPaymentLabels, deliveryLabels, optionPrice, orderCode, type CatalogProduct, type Order } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RequestChip } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
type Tab = "pending" | "confirmed" | "rejected";
const tabs: { id: Tab; label: string }[] = [
  { id: "pending", label: "Menunggu" },
  { id: "confirmed", label: "Dikonfirmasi" },
  { id: "rejected", label: "Ditolak" },
];
const REASONS = ["Stok habis", "Tidak bisa kirim ke alamat ini", "Pembeli tidak membalas", "Harga sudah berubah"];

function ago(iso: string) {
  if (!iso) return "baru saja";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}
const fullDate = (iso: string) =>
  iso
    ? new Date(iso)
        .toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        .replace(/,? (?:pukul )?(\d{2}[.:]\d{2})$/, " · $1")
    : "";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

/** What changed in the catalog since the buyer sent this request. */
function problems(order: Order, products: CatalogProduct[] | null) {
  if (!products) return new Map<number, string>();
  const out = new Map<number, string>();
  order.items.forEach((item, i) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.published) out.set(i, "Tidak lagi ditampilkan di katalog");
    else if (product.availability === "unavailable") out.set(i, "Sekarang belum tersedia");
    else if (optionPrice(product, item.option) !== item.unitPrice) out.set(i, `Harga sekarang ${formatRupiah(optionPrice(product, item.option))}`);
  });
  return out;
}
const isStale = (order: Order) => order.status === "pending" && !!order.createdAt && Date.now() - new Date(order.createdAt).getTime() > 3 * DAY;
const summary = (order: Order) =>
  order.items.map((i) => `${i.quantity}× ${i.name}${i.option ? ` · ${i.option}` : ""}`).join(" · ");

function OrderRow({
  order,
  selected,
  changed,
  saleNumber,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  changed: boolean;
  saleNumber?: string;
  onSelect: () => void;
}) {
  const pending = order.status === "pending";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl p-[18px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pending ? "border-[1.5px] border-dashed border-request/35 bg-[#FCF8F4] hover:bg-request-soft/50 dark:bg-request-soft/10" : "border bg-card hover:bg-accent",
        selected && (pending ? "border-request/60 bg-white shadow-card dark:bg-card" : "border-primary/40 shadow-card"),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-request">#{orderCode(order.id)}</span> · {ago(order.createdAt)}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold">{order.buyerName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted-foreground">Estimasi subtotal</p>
          <p className="num font-bold">{formatRupiah(order.subtotal)}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] text-[#3D4A42] dark:text-muted-foreground">{summary(order)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <RequestChip status={order.status} className="h-6 text-[11.5px]" />
        {pending && changed && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2.5 text-[11.5px] font-semibold text-warning">
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            Harga berubah
          </span>
        )}
        {isStale(order) && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Lebih dari 3 hari
          </span>
        )}
        {saleNumber && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 font-mono text-[11px] font-medium">
            <ReceiptText className="h-3 w-3" aria-hidden="true" />
            {saleNumber}
          </span>
        )}
      </div>
    </button>
  );
}

function OrderDetail({
  order,
  products,
  saleId,
  saleNumber,
  onReject,
  onBack,
}: {
  order: Order;
  products: CatalogProduct[] | null;
  saleId?: string;
  saleNumber?: string;
  onReject: () => void;
  onBack: () => void;
}) {
  const issues = order.status === "pending" ? problems(order, products) : new Map<number, string>();
  const code = orderCode(order.id);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b p-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke daftar pesanan"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="rounded-md bg-request-soft px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-request">Permintaan #{code}</span>
          <span className="text-[13px] text-muted-foreground">{fullDate(order.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {initials(order.buyerName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{order.buyerName}</h2>
            <p className="text-[13px] text-muted-foreground">{order.buyerPhone ? `WhatsApp +${order.buyerPhone}` : "Nama dari formulir pembeli · nomor WhatsApp ada di chat"}</p>
          </div>
          <a
            href={order.buyerPhone ? `https://wa.me/${order.buyerPhone}?text=${encodeURIComponent(`Halo ${order.buyerName}, terima kasih sudah memesan (Pesanan #${code}).`)}` : "https://wa.me/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border border-success/35 px-3 text-[13px] font-semibold text-success hover:bg-success-soft"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Buka chat
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Produk diminta · {order.items.length} dari maks. {MAX_ORDER_LINES} baris
        </p>
        <ul className="flex flex-col gap-3.5">
          {order.items.map((item, i) => {
            const product = products?.find((p) => p.id === item.productId);
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#F1EDE6] dark:bg-muted">
                  {product?.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.quantity}× {item.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {[item.option, `${formatRupiah(item.unitPrice)} / pcs`, item.kind === "digital" ? "Produk digital" : item.availability === "preorder" ? `PO ${item.leadTime}` : availabilityLabels[item.availability]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {issues.get(i) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[12.5px] font-semibold text-warning">
                      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                      {issues.get(i)}
                    </p>
                  )}
                </div>
                <p className="num shrink-0 font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</p>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between border-t border-dashed pt-3">
          <span className="text-sm text-muted-foreground">
            Estimasi subtotal <span className="text-xs">(belum termasuk ongkir)</span>
          </span>
          <span className="num text-lg font-bold">{formatRupiah(order.subtotal)}</span>
        </div>
        {(order.buyerDelivery || order.buyerPayment) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-background px-4 py-3 text-sm">
            {order.buyerDelivery && (
              <>
                <dt className="text-muted-foreground">Pengiriman</dt>
                <dd className="font-semibold">{deliveryLabels[order.buyerDelivery]}</dd>
              </>
            )}
            {order.buyerAddress && (
              <>
                <dt className="text-muted-foreground">Alamat</dt>
                <dd className="whitespace-pre-line break-words">{order.buyerAddress}</dd>
              </>
            )}
            {order.buyerPayment && (
              <>
                <dt className="text-muted-foreground">Pembayaran</dt>
                <dd className="font-semibold">{buyerPaymentLabels[order.buyerPayment]}</dd>
              </>
            )}
          </dl>
        )}
        {order.note && (
          <p className="flex gap-2 rounded-xl bg-background px-4 py-3 text-sm">
            <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />“{order.note}”
          </p>
        )}
        {issues.size > 0 && (
          <p role="note" className="flex gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong>Cek sebelum konfirmasi.</strong> Katalog berubah sejak pesanan dibuat. Harga di penjualan akan memakai yang Anda isi di formulir.</span>
          </p>
        )}
        {isStale(order) && (
          <p className="flex gap-2 rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Sudah lebih dari 3 hari. Hubungi pembeli atau tolak pesanan ini agar statusnya jelas.
          </p>
        )}
        {order.status === "pending" ? (
          <>
            <div className="flex gap-2.5">
              <Button asChild className="h-12 flex-1 rounded-xl text-[15px]">
                <Link to={`/sales?confirm=${order.id}`}><Check /> Konfirmasi &amp; catat penjualan</Link>
              </Button>
              <Button variant="outline" className="h-12 rounded-xl px-6 text-[15px] text-destructive hover:text-destructive" onClick={onReject}>
                <X /> Tolak
              </Button>
            </div>
            <p className="flex gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Konfirmasi membuka formulir penjualan berisi data ini. Penjualan baru dibuat saat Anda menyimpan.
            </p>
          </>
        ) : order.status === "confirmed" ? (
          <p className="flex items-center justify-between gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
            <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />Sudah dikonfirmasi dan tercatat sebagai penjualan.</span>
            {saleId && <Link to={`/sales?view=${saleId}`} className="font-mono font-semibold underline underline-offset-4">{saleNumber}</Link>}
          </p>
        ) : (
          <div className="rounded-xl bg-muted px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-semibold"><CircleX className="h-4 w-4" aria-hidden="true" />Ditolak, tidak ada penjualan dibuat.</p>
            {order.sellerNote && <p className="mt-1 text-muted-foreground">Alasan untuk pembeli: {order.sellerNote}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Orders() {
  const books = useBooks();
  const [params, setParams] = useSearchParams();
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
  const saleFor = (order: Order) => books.sales.find((s) => s.orderRequestId === order.id);
  const requested = books.orders.find((o) => o.id === params.get("id"));
  const tab: Tab = (params.get("tab") as Tab) || requested?.status || "pending";
  const list = lists[tab] ?? lists.pending;
  // Desktop always shows a detail; on phones the list opens it as its own page.
  const selected = requested ?? list[0];
  const showDetailOnly = !!requested;

  function select(order?: Order, nextTab = tab) {
    const next = new URLSearchParams(params);
    if (order) next.set("id", order.id);
    else next.delete("id");
    if (nextTab === "pending") next.delete("tab");
    else next.set("tab", nextTab);
    setParams(next, { replace: !order });
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusy(true);
    setError("");
    try {
      await rejectOrder(rejecting.id, reason);
      await books.reload();
      toast.success(`Permintaan #${orderCode(rejecting.id)} ditolak`);
      setRejecting(null);
      setReason("");
      select(undefined);
    } catch {
      setError("Pesanan belum ditolak. Periksa koneksi, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const empty = {
    pending: ["Belum ada permintaan baru", "Bagikan tautan toko Anda agar pembeli bisa memesan."],
    confirmed: ["Belum ada pesanan dikonfirmasi", "Pesanan yang Anda konfirmasi tercatat di Penjualan."],
    rejected: ["Tidak ada pesanan ditolak", "Permintaan yang Anda tolak muncul di sini."],
  }[tab];

  return (
    <>
      <header className={cn("flex flex-wrap items-end justify-between gap-4", showDetailOnly && "max-lg:hidden")}>
        <div className="max-w-xl">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Pesanan masuk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Permintaan dari katalog Anda. Pesanan tercatat sebagai penjualan <strong className="text-foreground">hanya setelah Anda konfirmasi</strong>.
          </p>
        </div>
        <div role="tablist" aria-label="Status pesanan" className="inline-flex rounded-xl bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => select(undefined, t.id)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                tab === t.id ? "bg-card font-semibold shadow-card" : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.id === "pending" && lists.pending.length > 0 && (
                <span className="rounded-full bg-request px-1.5 text-[11px] font-semibold leading-[18px] text-white">{lists.pending.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>
      {books.loading ? (
        <div role="status" aria-label="Memuat pesanan" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_550px]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : list.length === 0 && !requested ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Inbox className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
          <p className="font-semibold">{empty[0]}</p>
          <p className="text-sm text-muted-foreground">{empty[1]}</p>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_550px]">
          <ul aria-label="Daftar pesanan" className={cn("flex flex-col gap-3", showDetailOnly && "max-lg:hidden")}>
            {list.map((o) => (
              <li key={o.id}>
                <OrderRow
                  order={o}
                  selected={selected?.id === o.id}
                  changed={problems(o, products).size > 0}
                  saleNumber={saleFor(o)?.number}
                  onSelect={() => select(o)}
                />
              </li>
            ))}
          </ul>
          {selected && (
            <div className={cn("lg:sticky lg:top-20", !showDetailOnly && "max-lg:hidden")}>
              <OrderDetail
                key={selected.id}
                order={selected}
                products={products}
                saleId={saleFor(selected)?.id}
                saleNumber={saleFor(selected)?.number}
                onReject={() => {
                  setReason("");
                  setError("");
                  setRejecting(selected);
                }}
                onBack={() => select(undefined)}
              />
            </div>
          )}
        </div>
      )}
      <AlertDialog open={!!rejecting} onOpenChange={(open) => !open && !busy && setRejecting(null)}>
        <AlertDialogContent className="max-w-[460px]">
          <AlertDialogHeader className="text-left">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
              <CircleX className="h-5 w-5" aria-hidden="true" />
            </span>
            <AlertDialogTitle>Tolak permintaan {rejecting ? `#${orderCode(rejecting.id)}` : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">Tidak ada penjualan yang dibuat.</strong> Pembeli ({rejecting?.buyerName}) akan melihat status “Ditolak” di halaman pesanannya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">
              Alasan untuk pembeli <span className="font-normal text-muted-foreground">(opsional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    reason === r ? "border-foreground bg-foreground font-semibold text-background" : "hover:bg-accent",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <label htmlFor="reject-reason" className="sr-only">Alasan untuk pembeli (opsional)</label>
            <textarea
              id="reject-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tulis alasan lain"
              aria-describedby="reject-hint"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p id="reject-hint" className="text-xs text-muted-foreground">Alasan ini terlihat oleh pembeli. Maks. 300 karakter.</p>
          </fieldset>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Kembali</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmReject()}>
              {busy ? "Menolak…" : "Tolak permintaan"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
