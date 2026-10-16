import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Ban,
  Check,
  CheckCheck,
  CircleX,
  ClipboardCheck,
  Copy,
  Hourglass,
  Loader2,
  MessageCircle,
  MessageSquare,
  Package,
  Send,
  ShieldCheck,
  Truck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { getOrderStatus, resolveStore } from "@/lib/catalog-public-storage";
import { orderCode, type Order, type OrderProgress } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { NEW_ACCOUNT_ACCENT } from "@/lib/branding";
import { BuyerPage, ShopAvatar, ShopUnavailable, focusRing, useShopTheme } from "@/components/shop/shop-ui";

type Loaded = { order: Order; shopName: string; whatsapp: string; slug: string; storeId: string; accent?: string };

const when = (iso: string | undefined, withDay = false) =>
  iso
    ? new Date(iso)
        .toLocaleString("id-ID", {
          ...(withDay ? { weekday: "long" as const, year: "numeric" as const } : {}),
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(/,? (?:pukul )?(\d{2}[.:]\d{2})$/, " · $1")
    : "";

function timeline(order: Order) {
  const digital = order.items.every((i) => i.kind === "digital");
  const steps: { id: OrderProgress; label: string }[] = digital
    ? [
        { id: "confirmed", label: "Dikonfirmasi" },
        { id: "delivered", label: "Terkirim" },
        { id: "done", label: "Selesai" },
      ]
    : [
        { id: "confirmed", label: "Dikonfirmasi" },
        { id: "packed", label: "Dikemas" },
        { id: "shipped", label: "Dikirim" },
        { id: "done", label: "Selesai" },
      ];
  // A physical order marked "delivered" sits between shipped and done.
  const progress = !digital && order.progress === "delivered" ? "shipped" : order.progress;
  return { digital, steps, index: steps.findIndex((s) => s.id === progress) };
}

type Headline = { chip: string; icon: LucideIcon; tone: string; title: string; body?: string };
/** Chip, headline and body for each state (C1–C4). */
function headline(order: Order, digital: boolean, shopName: string): Headline {
  if (order.status === "rejected")
    return { chip: "Ditolak", icon: CircleX, tone: "bg-muted text-[#3D4A42]", title: "Pesanan ini tidak bisa diproses" };
  if (order.progress === "cancelled")
    return { chip: "Dibatalkan", icon: Ban, tone: "bg-muted text-[#3D4A42]", title: "Pesanan dibatalkan", body: "Hubungi penjual jika ada pertanyaan." };
  if (order.status === "pending")
    return {
      chip: "Menunggu konfirmasi",
      icon: Hourglass,
      tone: "bg-request-soft text-request",
      title: "Penjual sedang memeriksa pesanan Anda",
      body: "Biasanya dibalas lewat WhatsApp. Ongkir dan total akhir akan dikonfirmasi penjual.",
    };
  const byProgress: Partial<Record<OrderProgress, Headline>> = {
    confirmed: { chip: "Dikonfirmasi", icon: ClipboardCheck, tone: "bg-success-soft text-success", title: "Pesanan dikonfirmasi penjual" },
    packed: { chip: "Dikemas", icon: Package, tone: "bg-success-soft text-success", title: "Pesanan sedang dikemas" },
    shipped: { chip: "Dalam pengiriman", icon: Truck, tone: "bg-info-soft text-info", title: "Paket sedang menuju Anda" },
    delivered: digital
      ? {
          chip: "Sudah dikirim",
          icon: Send,
          tone: "bg-info-soft text-info",
          title: "Produk digital sudah dikirim",
          body: `Cek chat WhatsApp dari ${shopName} untuk file atau tautan Anda.`,
        }
      : { chip: "Sudah sampai", icon: Truck, tone: "bg-info-soft text-info", title: "Paket sudah sampai" },
    done: { chip: "Selesai", icon: CheckCheck, tone: "bg-success-soft text-success", title: "Pesanan selesai", body: "Terima kasih sudah berbelanja." },
  };
  return byProgress[order.progress] ?? byProgress.confirmed!;
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-1 font-mono text-[13px] font-semibold">
      {value}
      <button
        type="button"
        aria-label={`Salin ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            /* Still visible to copy by hand. */
          }
        }}
        className={cn("flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground", focusRing)}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">{copied ? `${label} disalin` : ""}</span>
    </span>
  );
}

const dot = (done: boolean, current: boolean) =>
  cn(
    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",
    done && "bg-shop text-white",
    current && "border-[3px] border-shop bg-white",
    !done && !current && "border-2 border-[#D5DDD3] bg-white",
  );

export function OrderStatus() {
  const { store = "", orderId = "" } = useParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ok">("loading");

  const load = useCallback(async () => {
    try {
      const storeId = await resolveStore(store);
      const result = storeId ? await getOrderStatus(storeId, orderId) : null;
      if (!result || !storeId) return setState("missing");
      setData({ ...result, storeId });
      setState("ok");
    } catch {
      setState((current) => (current === "ok" ? current : "error"));
    }
  }, [store, orderId]);
  useEffect(() => {
    void load();
    // Kept fresh while open, so the buyer sees the seller's updates without reloading.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  // A closed shop is unreadable, so its accent may be unknown; the platform green is used then.
  useShopTheme(data?.accent ?? NEW_ACCOUNT_ACCENT, data ? `Pesanan #${orderCode(orderId)} · ${data.shopName}` : "Status pesanan");

  if (state === "loading")
    return (
      <BuyerPage>
        <main role="status" className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Memuat pesanan…
        </main>
      </BuyerPage>
    );
  if (state === "error")
    return (
      <BuyerPage>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-[21px] font-bold">Status belum dapat dimuat</h1>
          <p className="text-sm text-muted-foreground">Periksa koneksi Anda lalu coba lagi.</p>
          <button type="button" onClick={() => void load()} className={cn("mt-2 h-12 rounded-[14px] bg-shop px-6 text-[15px] font-bold text-white", focusRing)}>
            Coba lagi
          </button>
        </main>
      </BuyerPage>
    );
  if (state === "missing" || !data)
    return (
      <ShopUnavailable
        title="Pesanan tidak ditemukan"
        body="Periksa kembali tautan dari penjual, atau hubungi penjual langsung jika Anda punya nomornya."
      />
    );

  const { order, shopName } = data;
  const code = orderCode(order.id);
  const { digital, steps, index } = timeline(order);
  const h = headline(order, digital, shopName);
  const rejected = order.status === "rejected";
  const cancelled = order.progress === "cancelled";
  const tracking = !rejected && !cancelled && order.status === "confirmed";
  const [courier, resi] = order.trackingNo.includes(" · ") ? order.trackingNo.split(" · ", 2) : ["", order.trackingNo];
  const contact = data.whatsapp
    ? `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(`Halo ${shopName}, saya ${order.buyerName}. Mau menanyakan pesanan #${code}.`)}`
    : "";
  const shopPath = `/shop/${encodeURIComponent(data.slug || data.storeId)}`;
  const Icon = h.icon;

  return (
    <BuyerPage>
      <header className="flex items-center gap-2.5 bg-white px-5 py-3.5">
        <a href={shopPath} aria-label={`Kembali ke katalog ${shopName}`} className={cn("rounded-full", focusRing)}>
          <ShopAvatar name={shopName} size={36} ring={false} />
        </a>
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{shopName}</p>
        <span className="font-mono text-xs font-medium text-muted-foreground">#{code}</span>
      </header>
      <main className="flex flex-col gap-3.5 p-5">
        <section className="flex flex-col gap-4 rounded-[18px] bg-white p-5">
          <div className="flex flex-col items-start gap-2.5">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", h.tone)}>
              <Icon className="h-3 w-3" aria-hidden="true" />
              {h.chip}
            </span>
            <h1 aria-live="polite" className="text-[21px] font-bold tracking-tight">{h.title}</h1>
            {h.body && <p className="text-[13.5px] leading-relaxed text-[#3D4A42]">{h.body}</p>}
            {order.status === "pending" && order.createdAt && (
              <span className="text-xs text-muted-foreground">Dikirim {when(order.createdAt, true)}</span>
            )}
          </div>

          {rejected && (
            <>
              {order.sellerNote && (
                <div className="w-full rounded-xl bg-background px-3.5 py-3 text-sm">
                  <p className="mb-0.5 text-xs text-muted-foreground">Alasan dari penjual</p>
                  <p>{order.sellerNote}</p>
                </div>
              )}
              <p className="text-[13.5px] leading-relaxed text-[#3D4A42]">
                Tidak ada pembayaran yang ditagih. Anda bisa memilih produk lain di toko.
              </p>
            </>
          )}

          {tracking && !digital && (
            <ol aria-label="Progres pesanan" className="flex flex-col">
              {steps.map((step, i) => {
                const done = i < index || (i === index && step.id === "done");
                const current = i === index && !done;
                const stamp = order.steps[step.id];
                return (
                  <li key={step.id} className="flex gap-3" aria-current={current ? "step" : undefined}>
                    <div className="flex flex-col items-center">
                      <span className={dot(done, current)}>{done && <Check className="h-3 w-3" aria-hidden="true" />}</span>
                      {i < steps.length - 1 && <span className={cn("h-7 w-0.5", i < index ? "bg-shop" : "bg-[#E4EAE2]")} />}
                    </div>
                    <div className="pb-1 text-sm">
                      <p className={cn(done || current ? "font-bold" : "text-muted-foreground")}>
                        {step.label}
                        <span className="sr-only">{done ? " (selesai)" : current ? " (sekarang)" : ""}</span>
                      </p>
                      {(done || current) && stamp && <p className="text-xs text-muted-foreground">{when(stamp)}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {tracking && digital && (
            <div>
              <ol aria-label="Progres pesanan" className="flex items-center gap-2">
                {steps.map((step, i) => {
                  const done = i < index || (i === index && step.id === "done");
                  const current = i === index && !done;
                  return (
                    <li key={step.id} className="contents" aria-current={current ? "step" : undefined}>
                      <span className={dot(done, current)}>
                        {done && <Check className="h-3 w-3" aria-hidden="true" />}
                        <span className="sr-only">
                          {step.label}
                          {done ? " (selesai)" : current ? " (sekarang)" : ""}
                        </span>
                      </span>
                      {i < steps.length - 1 && <span aria-hidden="true" className={cn("h-0.5 flex-1", i < index ? "bg-shop" : "bg-[#E4EAE2]")} />}
                    </li>
                  );
                })}
              </ol>
              <div aria-hidden="true" className="mt-2 flex justify-between text-xs text-muted-foreground">
                {steps.map((step, i) => (
                  <span key={step.id} className={cn("flex flex-col", i === 1 && "items-center", i === steps.length - 1 && "items-end")}>
                    <span className={cn(i === index && "font-bold text-foreground")}>{step.label}</span>
                    {i <= index && order.steps[step.id] && <span className="text-[11px]">{when(order.steps[step.id])}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tracking && !digital && order.trackingNo && (
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-background p-3.5">
              {courier && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Kurir</span>
                  <strong>{courier}</strong>
                </div>
              )}
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">No. resi</span>
                <CopyValue value={resi} label="nomor resi" />
              </div>
            </div>
          )}

          {tracking && digital && (
            <p className="flex gap-2 rounded-xl bg-background px-3.5 py-3 text-[12.5px] leading-normal text-[#3D4A42]">
              <ShieldCheck className="h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
              Demi keamanan, kode atau tautan tidak pernah ditampilkan di halaman ini.
            </p>
          )}
        </section>

        {order.sellerNote && !rejected && (
          <section className="flex flex-col gap-2 rounded-[18px] bg-white px-[18px] py-4 text-sm">
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <MessageSquare className="h-[13px] w-[13px]" aria-hidden="true" />
              Pesan dari penjual
            </p>
            <p>“{order.sellerNote}”</p>
          </section>
        )}

        <section
          aria-label="Rincian pesanan"
          className={cn("flex flex-col gap-2 rounded-[18px] bg-white px-[18px] py-4 text-sm", rejected && "text-muted-foreground")}
        >
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className={cn("min-w-0 break-words", rejected && "line-through")}>
                {item.quantity}× {item.name}
                {item.option ? ` · ${item.option}` : ""}
              </span>
              <span className={cn("num shrink-0", rejected && "line-through")}>{formatRupiah(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          {!rejected && (
            <div className="flex justify-between border-t border-dashed border-[#E4EAE2] pt-2.5">
              <span className="text-muted-foreground">Subtotal</span>
              <strong className="num">{formatRupiah(order.subtotal)}</strong>
            </div>
          )}
        </section>

        {rejected ? (
          <a href={shopPath} className={cn("flex h-[52px] items-center justify-center rounded-[14px] bg-shop text-[15px] font-bold text-white", focusRing)}>
            Lihat produk lain
          </a>
        ) : (
          contact && (
            <a
              href={contact}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-[#DFE4DC] bg-white text-[15px] font-semibold text-[#1F7A4A]",
                focusRing,
              )}
            >
              <MessageCircle className="h-[17px] w-[17px]" aria-hidden="true" />
              Chat penjual
            </a>
          )
        )}
        <p className="text-center text-xs text-muted-foreground">Halaman ini diperbarui otomatis.</p>
      </main>
    </BuyerPage>
  );
}
