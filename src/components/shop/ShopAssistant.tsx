import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, MessageCircleQuestion, Package, Send, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { optionPrice, type CatalogProduct, type Storefront } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { focusRing } from "./shop-ui";

/**
 * Buyer-side shop assistant (docs/shop-assistant.md): answers questions from
 * the published catalog via /api/shop-chat and suggests products. Stock,
 * shipping and payment always go to the seller's WhatsApp.
 */
type Message = { role: "user" | "assistant"; text: string; productIds?: string[]; notice?: boolean };

const MAX_TEXT = 500;
const MAX_SENT = 12;
const STARTERS = ["Produk apa saja yang ready?", "Ada pilihan ukuran apa saja?", "Berapa lama kalau PO?"];
const key = (storeId: string) => `ruang-usaha:assistant:${storeId}`;

function load(storeId: string): Message[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(storeId)) || "[]");
    return Array.isArray(saved) ? saved.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string").slice(-40) : [];
  } catch {
    return [];
  }
}

export function ShopAssistant({
  store,
  slug,
  products,
  raised,
  onOpenProduct,
}: {
  store: Storefront;
  slug: string;
  products: CatalogProduct[];
  /** The cart bar is showing; sit above it. */
  raised: boolean;
  onOpenProduct: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => load(store.id));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [off, setOff] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(key(store.id), JSON.stringify(messages.slice(-40)));
    } catch {
      /* private mode: history just isn't kept */
    }
  }, [messages, store.id]);
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, sending]);

  if (off) return null;
  const byId = new Map(products.map((p) => [p.id, p]));
  const chat = store.whatsapp ? `https://wa.me/${store.whatsapp}` : null;

  async function ask(question: string) {
    const q = question.trim().slice(0, MAX_TEXT);
    if (!q || sending) return;
    const next: Message[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setText("");
    setSending(true);
    const history = next.filter((m) => !m.notice).slice(-MAX_SENT).map(({ role, text }) => ({ role, text }));
    let reply: Message;
    try {
      const res = await fetch("/api/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: history }),
      });
      if (res.status === 404 || res.status === 503) {
        reply = { role: "assistant", text: "Asisten sedang tidak aktif. Silakan chat penjual lewat WhatsApp ya.", notice: true };
      } else if (res.status === 429) {
        reply = { role: "assistant", text: "Pertanyaannya banyak sekali. Coba lagi beberapa menit lagi, atau chat penjual lewat WhatsApp.", notice: true };
      } else if (!res.ok) {
        reply = { role: "assistant", text: "Maaf, pertanyaan belum terkirim. Coba lagi.", notice: true };
      } else {
        const data = (await res.json()) as { reply?: string; productIds?: string[]; fallback?: boolean };
        reply = {
          role: "assistant",
          text: String(data.reply || "Maaf, asisten belum bisa menjawab."),
          productIds: (data.productIds ?? []).filter((id) => byId.has(id)),
          notice: data.fallback ? true : undefined,
        };
      }
    } catch {
      reply = { role: "assistant", text: "Koneksi terputus. Periksa internet Anda lalu coba lagi.", notice: true };
    }
    setMessages((current) => [...current, reply]);
    setSending(false);
  }

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-30 px-4",
          raised ? "bottom-[calc(max(1.75rem,env(safe-area-inset-bottom))+72px)]" : "bottom-[max(1.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mx-auto flex max-w-[528px] justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-shop-ink shadow-[0_10px_24px_-8px_rgba(20,30,25,0.4)] ring-1 ring-[#DFE4DC]",
              focusRing,
            )}
          >
            <MessageCircleQuestion className="h-[18px] w-[18px]" aria-hidden="true" />
            Tanya toko
          </button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex h-[85dvh] max-w-[560px] flex-col gap-0 rounded-t-3xl bg-[#F4F5F0] p-0 text-[#24332B]"
        >
          <SheetHeader className="border-b border-[#E4EAE2] bg-white px-5 pb-3 pt-5 text-left">
            <SheetTitle className="pr-8 text-base">Tanya {store.name}</SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Asisten otomatis · menjawab dari katalog toko
            </SheetDescription>
          </SheetHeader>

          <div role="log" aria-live="polite" aria-label="Percakapan" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble role="assistant">
              Halo! Saya asisten otomatis {store.name}. Tanyakan soal produk, harga, atau pilihan yang ada ya.
            </Bubble>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pl-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className={cn("h-9 rounded-full border border-[#DFE4DC] bg-white px-3.5 text-[13px] font-medium", focusRing)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <Bubble role={m.role} muted={m.notice}>{m.text}</Bubble>
                {!!m.productIds?.length && (
                  <ul aria-label="Produk yang disarankan" className="space-y-2 pl-1">
                    {m.productIds.map((id) => {
                      const p = byId.get(id)!;
                      const prices = p.options.length ? p.options.map((o) => optionPrice(p, o.label)) : [p.price];
                      const from = new Set(prices).size > 1;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onOpenProduct(id);
                            }}
                            className={cn("flex w-full max-w-[340px] items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-sm", focusRing)}
                          >
                            {p.image ? (
                              <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-shop-soft text-shop-ink">
                                <Package className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{p.name}</span>
                              <span className="num block text-[13px] font-bold text-shop-ink">
                                {from ? "mulai " : ""}
                                {formatRupiah(Math.min(...prices))}
                              </span>
                            </span>
                            <span className="text-xs font-semibold text-shop-ink">Lihat</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
            {sending && (
              <p className="flex items-center gap-2 pl-1 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Asisten sedang mengetik…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <div className="space-y-2.5 border-t border-[#E4EAE2] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">Pertanyaan Anda</span>
                <input
                  value={text}
                  maxLength={MAX_TEXT}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Tulis pertanyaan…"
                  className={cn("h-12 w-full rounded-[14px] border border-[#8D978F] bg-white px-4 text-[15px] outline-none", focusRing)}
                />
              </label>
              <button
                type="submit"
                aria-label="Kirim pertanyaan"
                disabled={sending || !text.trim()}
                className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-shop text-white disabled:opacity-50", focusRing)}
              >
                <Send className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </form>
            <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Untuk stok, ongkir &amp; pembayaran, chat penjual.</span>
              {chat && (
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-[#E3F1E7] px-3 text-[13px] font-semibold text-[#1F6B40]", focusRing)}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Chat penjual
                </a>
              )}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Bubble({ role, muted, children }: { role: Message["role"]; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed",
          role === "user" ? "rounded-br-md bg-shop text-white" : "rounded-bl-md bg-white",
          muted && "bg-[#FBF0D9] text-[#7F520A]",
        )}
      >
        <span className="sr-only">{role === "user" ? "Anda: " : "Asisten: "}</span>
        {children}
      </p>
    </div>
  );
}
