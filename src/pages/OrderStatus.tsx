import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderStatus, resolveStore } from "@/lib/catalog-public-storage";
import { orderCode, type Order } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Loaded = { order: Order; shopName: string; whatsapp: string; slug: string; storeId: string };

function steps(order: Order) {
  const digital = order.items.every((i) => i.kind === "digital");
  return digital
    ? [
        { id: "confirmed", label: "Dikonfirmasi" },
        { id: "delivered", label: "Produk terkirim" },
        { id: "done", label: "Selesai" },
      ]
    : [
        { id: "confirmed", label: "Dikonfirmasi" },
        { id: "packed", label: "Dikemas" },
        { id: "shipped", label: "Dikirim" },
        { id: "done", label: "Selesai" },
      ];
}

export function OrderStatus() {
  const { store = "", orderId = "" } = useParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ok">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      try {
        const storeId = await resolveStore(store);
        const result = storeId ? await getOrderStatus(storeId, orderId) : null;
        if (!result || !storeId) return setState("missing");
        setData({ ...result, storeId });
        setState("ok");
      } catch {
        setState((current) => (current === "ok" ? current : "error"));
      } finally {
        setRefreshing(false);
      }
    },
    [store, orderId],
  );
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    document.title = data ? `Pesanan #${orderCode(orderId)} · ${data.shopName}` : "Status pesanan";
    return () => {
      root.style.removeProperty("color-scheme");
    };
  }, [data, orderId]);

  if (state === "loading")
    return <main role="status" className="mx-auto max-w-lg p-8 text-center"><Loader2 className="mx-auto animate-spin" aria-hidden="true" /> Memuat pesanan…</main>;
  if (state === "error")
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Status belum dapat dimuat</h1>
        <p className="text-muted-foreground">Periksa koneksi Anda lalu coba lagi.</p>
        <Button onClick={() => void load()}>Coba lagi</Button>
      </main>
    );
  if (state === "missing" || !data)
    return (
      <main className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Pesanan tidak ditemukan</h1>
        <p className="text-muted-foreground">Periksa kembali tautan dari penjual, atau hubungi penjual langsung.</p>
      </main>
    );

  const { order } = data;
  const code = orderCode(order.id);
  const list = steps(order);
  const index = list.findIndex((s) => s.id === order.progress);
  const cancelled = order.status === "rejected" || order.progress === "cancelled";
  const contact = data.whatsapp
    ? `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(`Halo ${data.shopName}, saya ${order.buyerName}. Mau menanyakan pesanan #${code}.`)}`
    : "";
  const headline = cancelled
    ? order.status === "rejected" ? "Pesanan ditolak" : "Pesanan dibatalkan"
    : order.status === "pending"
      ? "Menunggu konfirmasi penjual"
      : list[Math.max(index, 0)].label;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <a href={`/shop/${encodeURIComponent(data.slug || data.storeId)}`} aria-label={`Kembali ke katalog ${data.shopName}`} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-accent">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </a>
          <p className="truncate font-semibold">{data.shopName}</p>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <section className="space-y-1">
          <p className="text-sm text-muted-foreground">Pesanan #{code} · {order.buyerName}</p>
          <h1 className="text-2xl font-semibold" aria-live="polite">{headline}</h1>
          {order.status === "pending" && (
            <p className="text-sm text-muted-foreground">Penjual akan mengonfirmasi lewat WhatsApp. Halaman ini diperbarui otomatis.</p>
          )}
          {order.sellerNote && (
            <p className="rounded-lg border bg-card p-3 text-sm">Catatan penjual: {order.sellerNote}</p>
          )}
        </section>

        {!cancelled && order.status === "confirmed" && (
          <ol aria-label="Progres pesanan" className="space-y-0 rounded-2xl border bg-card p-4">
            {list.map((step, i) => {
              const done = i < index || (i === index && step.id === "done");
              const current = i === index && !done;
              return (
                <li key={step.id} className="flex gap-3" aria-current={current ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary bg-primary/10 text-primary",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                    </span>
                    {i < list.length - 1 && <span className={cn("my-1 w-px flex-1 min-h-5", i < index ? "bg-primary" : "bg-border")} />}
                  </div>
                  <div className="pb-4">
                    <p className={cn("text-sm", (done || current) ? "font-medium" : "text-muted-foreground")}>{step.label}</p>
                    {step.id === "shipped" && order.trackingNo && i <= index && (
                      <p className="mt-0.5 text-sm text-muted-foreground">Resi: <strong className="text-foreground">{order.trackingNo}</strong></p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <section aria-labelledby="os-items" className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 id="os-items" className="text-sm font-semibold">Rincian</h2>
          <ul className="space-y-1 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{item.quantity}× {item.name}{item.option ? ` · ${item.option}` : ""}</span>
                <span className="num shrink-0">{formatRupiah(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Subtotal produk</span><span className="num">{formatRupiah(order.subtotal)}</span>
          </p>
          <p className="text-xs text-muted-foreground">Ongkir dan total akhir dikonfirmasi penjual.</p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          {contact && (
            <Button asChild className="flex-1" size="lg">
              <a href={contact} target="_blank" rel="noopener noreferrer"><MessageCircle /> Hubungi penjual</a>
            </Button>
          )}
          <Button variant="outline" size="lg" disabled={refreshing} onClick={() => void load(true)}>
            <RefreshCw className={cn(refreshing && "animate-spin")} /> Segarkan
          </Button>
        </div>
      </main>
    </div>
  );
}
