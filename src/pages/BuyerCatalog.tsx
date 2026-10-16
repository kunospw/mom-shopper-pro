import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleSlash,
  Clock,
  Copy,
  Download,
  List,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  createOrderRequest,
  getPublicCatalog,
  newOrderId,
  resolveStore,
} from "@/lib/catalog-public-storage";
import {
  cartTotal,
  optionPrice,
  orderCode,
  orderMessage,
  orderSignature,
  reconcileCart,
  shortRupiah,
  whatsAppLink,
  MAX_ORDER_LINES,
  type CartLine,
  type CatalogProduct,
  type Storefront,
} from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { AvailabilityBadge, ShopProductCard } from "@/components/ShopProductCard";
import {
  BuyerPage,
  BuyerTopBar,
  Callout,
  ShopAvatar,
  ShopUnavailable,
  focusRing,
  useShopTheme,
} from "@/components/shop/shop-ui";

type CatalogData = { store: Storefront; products: CatalogProduct[] };
type Placed = { id: string; waUrl: string; message: string; statusPath: string };
/** What the buyer saw before a re-check changed the catalog (B5). */
type Review = { products: CatalogProduct[]; lines: CartLine[] };

const slugOf = (store: Storefront) => store.slug || store.id;
const KEYS = {
  name: "ruang-usaha:buyer-name",
  cart: (id: string) => `ruang-usaha:buyer-cart:${id}`,
  last: (id: string) => `ruang-usaha:buyer-last:${id}`,
  draft: (id: string) => `ruang-usaha:buyer-draft-id:${id}`,
  placed: (id: string) => `ruang-usaha:buyer-placed:${id}`,
};
const read = (store: Storage, key: string) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, value: string | null) => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* Storage is a convenience; everything also lives in memory. */
  }
};

/** A quantity stepper; shows a trash icon instead of minus at 1 when `onRemove` is given. */
function Stepper({
  value,
  onChange,
  onRemove,
  label,
  size = "md",
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  onRemove?: () => void;
  label: string;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  const box = size === "lg" ? "h-[52px] rounded-[13px]" : "h-9 rounded-[10px]";
  const button = cn(size === "lg" ? "w-11" : "w-9", "flex h-full items-center justify-center disabled:opacity-40", focusRing);
  const removing = value <= 1 && onRemove;
  return (
    <div role="group" aria-label={label} className={cn("flex items-center border border-[#DFE4DC] bg-white", box)}>
      <button
        type="button"
        disabled={disabled || (!removing && value <= 1)}
        aria-label={removing ? `Hapus ${label.replace(/^Jumlah /, "")}` : `Kurangi ${label.replace(/^Jumlah /, "")}`}
        onClick={() => (removing ? onRemove() : onChange(value - 1))}
        className={button}
      >
        {removing ? <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-4 w-4" aria-hidden="true" />}
      </button>
      <span aria-live="polite" className={cn("num text-center font-bold", size === "lg" ? "w-7 text-base" : "w-[22px] text-sm")}>
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= 99}
        aria-label={`Tambah ${label.replace(/^Jumlah /, "")}`}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Thumb({ product, className }: { product?: CatalogProduct; className?: string }) {
  return (
    <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#F1EDE6]", className)}>
      {product?.image ? (
        <img src={product.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <ShoppingBag className="h-5 w-5 text-[#8C7A68]/40" aria-hidden="true" />
      )}
    </span>
  );
}

/** B2 / B3: full-screen product page. */
function ProductPage({
  product,
  onBack,
  onAdd,
}: {
  product: CatalogProduct;
  onBack: () => void;
  onAdd: (option: string, quantity: number) => boolean;
}) {
  const hasOptions = product.options.length > 0;
  const [option, setOption] = useState(product.options.length === 1 ? product.options[0].label : "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [shared, setShared] = useState("");
  const soldOut = product.availability === "unavailable";
  const unit = optionPrice(product, option);
  const shownPrice = hasOptions && !option ? null : unit;

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared("Tautan produk disalin.");
      }
    } catch {
      /* The buyer closed the share sheet. */
    }
  }
  function add() {
    if (hasOptions && !option) {
      setError(`Pilih ${product.optionLabel.toLocaleLowerCase("id-ID")} dulu.`);
      return;
    }
    onAdd(option, quantity);
  }

  return (
    <BuyerPage tone="white">
      <div className="relative flex aspect-square max-h-[380px] w-full items-center justify-center overflow-hidden bg-[#EEF2EC] sm:max-h-[440px]">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ShoppingBag className="h-16 w-16 text-[#6F8070]/30" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali ke katalog"
          className={cn("absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card", focusRing)}
        >
          <ArrowLeft className="h-[19px] w-[19px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void share()}
          aria-label="Bagikan produk"
          className={cn("absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card", focusRing)}
        >
          <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <main className="relative -mt-5 flex flex-1 flex-col gap-4 rounded-t-[22px] bg-white p-5 pb-32">
        <div className="flex flex-wrap gap-1.5">
          {product.availability === "ready" && product.kind === "physical" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-[3px] text-[11.5px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Ready stock
            </span>
          )}
          {product.availability !== "ready" && <AvailabilityBadge product={product} className="px-2 py-[3px] text-[11.5px]" />}
          {product.kind === "digital" ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-info-soft px-2 py-[3px] text-[11.5px] font-semibold text-info">
              <Download className="h-[11px] w-[11px]" aria-hidden="true" />
              Produk digital
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#DFE4DC] px-2 py-[3px] text-[11.5px] font-semibold">
              <Package className="h-[11px] w-[11px]" aria-hidden="true" />
              Barang fisik · dikirim kurir
            </span>
          )}
        </div>
        <div>
          <h1 className="break-words text-[22px] font-bold tracking-tight">{product.name}</h1>
          <p className="num mt-1 text-[22px] font-bold text-shop-ink">
            {shownPrice === null ? `mulai ${formatRupiah(Math.min(...product.options.map((o) => optionPrice(product, o.label))))}` : formatRupiah(shownPrice)}
          </p>
        </div>
        {hasOptions && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13.5px] font-semibold">
              {product.optionLabel} <span className="text-destructive" aria-hidden="true">*</span>
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {product.options.map((o) => {
                const active = option === o.label;
                return (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setOption(o.label);
                      setError("");
                    }}
                    className={cn(
                      "flex min-h-[52px] flex-col items-center justify-center rounded-[11px] px-1 py-1.5 text-center",
                      active ? "border-2 border-shop bg-shop-soft text-shop-ink" : "border border-[#DFE4DC]",
                      focusRing,
                    )}
                  >
                    <span className={cn("break-words text-sm leading-tight", active ? "font-bold" : "font-semibold")}>{o.label}</span>
                    <span className={cn("num text-[11px]", active ? "text-shop-ink" : "text-muted-foreground")}>
                      {shortRupiah(optionPrice(product, o.label))}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {product.kind === "digital" && (
          <Callout tone="info" icon={<Send className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />}>
            <strong>Dikirim lewat WhatsApp</strong> setelah pembayaran dikonfirmasi penjual. Tanpa ongkir.
          </Callout>
        )}
        {product.availability === "preorder" && (
          <Callout tone="warning" icon={<Clock className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />}>
            <strong>Preorder{product.leadTime ? ` · estimasi ${product.leadTime}` : ""}</strong>
            <br />
            <span className="text-[#3D4A42]">Diproses setelah pesanan dikonfirmasi. Tanggal pasti dari penjual.</span>
          </Callout>
        )}
        {soldOut && (
          <Callout tone="muted" icon={<CircleSlash className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />}>
            <strong>Belum tersedia</strong>
            <br />
            <span className="text-[#3D4A42]">Produk ini tampil di katalog tapi belum bisa dipesan.</span>
          </Callout>
        )}
        {product.description && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#3D4A42]">{product.description}</p>
        )}
        <p role="status" className="sr-only">{shared}</p>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#EEF1EC] bg-white">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3.5">
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex items-center gap-2.5">
            {!soldOut && <Stepper size="lg" label={`Jumlah ${product.name}`} value={quantity} onChange={setQuantity} />}
            <button
              type="button"
              disabled={soldOut}
              onClick={add}
              className={cn(
                "num h-[52px] flex-1 rounded-[13px] bg-shop px-4 text-[15px] font-bold text-white disabled:bg-muted disabled:text-muted-foreground",
                focusRing,
              )}
            >
              {soldOut
                ? "Belum tersedia"
                : shownPrice === null
                  ? "Tambah ke pesanan"
                  : `Tambah · ${formatRupiah(shownPrice * quantity)}`}
            </button>
          </div>
        </div>
      </div>
    </BuyerPage>
  );
}

function OrderLines({
  lines,
  products,
  onQuantity,
  onRemove,
  disabled,
}: {
  lines: CartLine[];
  products: CatalogProduct[];
  onQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="rounded-2xl bg-white px-3.5 py-1.5">
      {lines.map((line, index) => {
        const product = products.find((p) => p.id === line.productId);
        if (!product) return null;
        const unit = optionPrice(product, line.option);
        return (
          <li key={`${line.productId}-${line.option}`} className="flex gap-3 border-b border-[#F0F2EE] py-3 last:border-0">
            <Thumb product={product} />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold">{product.name}</p>
              <p className="num text-[12.5px] text-muted-foreground">
                {line.option ? `${line.option} · ` : ""}
                {formatRupiah(unit)}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <Stepper
                  label={`Jumlah ${product.name}`}
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(q) => onQuantity(index, q)}
                  onRemove={() => onRemove(index)}
                />
                <span className="num text-sm font-bold">{formatRupiah(unit * line.quantity)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** B5: what changed between what the buyer saw and the live catalog. */
function ReviewLines({ review, products, cart }: { review: Review; products: CatalogProduct[]; cart: CartLine[] }) {
  return (
    <ul className="rounded-2xl bg-white px-3.5 py-1.5">
      {review.lines.map((line) => {
        const before = review.products.find((p) => p.id === line.productId);
        const now = products.find((p) => p.id === line.productId);
        const kept = cart.find((l) => l.productId === line.productId && l.option === line.option);
        const name = before?.name ?? now?.name ?? "Produk";
        const oldUnit = before ? optionPrice(before, line.option) : 0;
        const newUnit = now && kept ? optionPrice(now, line.option) : 0;
        const meta = `${line.option ? `${line.option} · ` : ""}${line.quantity}×`;
        return (
          <li key={`${line.productId}-${line.option}`} className={cn("flex gap-3 border-b border-[#F0F2EE] py-3 last:border-0", !kept && "opacity-70")}>
            <Thumb product={now ?? before} />
            <div className="min-w-0 flex-1">
              <p className={cn("break-words text-sm font-semibold", !kept && "line-through")}>{name}</p>
              {kept ? (
                <>
                  <p className="text-[12.5px] text-muted-foreground">{meta}</p>
                  {oldUnit !== newUnit ? (
                    <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="text-muted-foreground line-through">{formatRupiah(oldUnit * line.quantity)}</span>
                      <ArrowRight className="h-3 w-3" aria-label="menjadi" />
                      <strong className="text-sm">{formatRupiah(newUnit * line.quantity)}</strong>
                      <span className="rounded-[5px] bg-warning-soft px-1.5 py-px text-[11px] font-semibold text-warning">harga baru</span>
                    </p>
                  ) : (
                    <p className="num mt-1 text-sm font-bold">{formatRupiah(newUnit * line.quantity)}</p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-destructive">
                  <CircleSlash className="h-3 w-3" aria-hidden="true" />
                  Sekarang belum tersedia — dihapus dari pesanan
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** B6: saved; the buyer opens WhatsApp themselves, so a failed hand-off never loses the order. */
function PlacedPage({ placed, store, onBack }: { placed: Placed; store: Storefront; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = orderCode(placed.id);
  return (
    <BuyerPage tone="white">
      <button
        type="button"
        onClick={onBack}
        aria-label="Kembali ke katalog"
        className={cn("absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-background", focusRing)}
      >
        <ArrowLeft className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col items-center gap-3 px-6 pt-[72px] text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-shop-soft text-shop">
            <Check className="h-[30px] w-[30px]" aria-hidden="true" />
          </span>
          <h1 className="mt-1.5 text-[22px] font-bold tracking-tight">Pesanan tersimpan</h1>
          <div className="flex items-center gap-2.5 rounded-[10px] bg-background py-1.5 pl-3.5 pr-1.5 font-mono text-[15px] font-semibold">
            #{code}
            <button
              type="button"
              aria-label={`Salin kode #${code}`}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`#${code}`);
                  setCopied(true);
                } catch {
                  /* The code stays visible to copy by hand. */
                }
              }}
              className={cn("flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground", focusRing)}
            >
              {copied ? <Check className="h-[15px] w-[15px]" aria-hidden="true" /> : <Copy className="h-[15px] w-[15px]" aria-hidden="true" />}
            </button>
          </div>
          <p role="status" className="sr-only">{copied ? "Kode disalin" : ""}</p>
          <p className="text-sm leading-relaxed text-[#3D4A42]">
            Satu langkah lagi: kirim pesan ke {store.name} agar penjual bisa mengonfirmasi stok, ongkir, dan pembayaran.
          </p>
        </div>
        <section aria-label="Pesan yang akan dikirim" className="mx-5 mt-5 flex flex-col gap-1.5 rounded-2xl bg-[#EFEAE2] p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pesan yang akan dikirim</span>
          <p className="max-w-[92%] self-end whitespace-pre-line break-words rounded-xl rounded-br-sm bg-[#DCF3D3] px-3 py-2.5 text-[12.5px] leading-normal text-[#1D2A22]">
            {placed.message}
          </p>
        </section>
        <div className="mt-auto flex flex-col gap-2.5 px-5 pb-8 pt-4">
          <a
            href={placed.waUrl}
            className={cn("flex h-14 items-center justify-center gap-2 rounded-[14px] bg-[#1F7A4A] text-base font-bold text-white", focusRing)}
          >
            <MessageCircle className="h-[19px] w-[19px]" aria-hidden="true" />
            Buka WhatsApp
          </a>
          <a
            href={placed.statusPath}
            className={cn("flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-[#DFE4DC] bg-white text-[15px] font-semibold", focusRing)}
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Lacak status pesanan
          </a>
          <p className="mt-0.5 text-center text-xs leading-normal text-muted-foreground">
            Simpan kode di atas. Pesanan belum menjadi pembelian sampai penjual mengonfirmasi.
          </p>
        </div>
      </main>
    </BuyerPage>
  );
}

function CatalogView({ initial }: { initial: CatalogData }) {
  const [data, setData] = useState(initial);
  const { store, products } = data;
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [orderError, setOrderError] = useState("");
  const [failed, setFailed] = useState(false);
  const [closed, setClosed] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  // Kept for the session so coming back from WhatsApp lands on the same confirmation.
  const [placed, setPlaced] = useState<Placed | null>(() => {
    try {
      const saved = JSON.parse(read(sessionStorage, KEYS.placed(store.id)) || "null");
      return saved && typeof saved.id === "string" && typeof saved.message === "string" &&
        typeof saved.waUrl === "string" && saved.waUrl.startsWith("https://wa.me/") &&
        typeof saved.statusPath === "string" && saved.statusPath.startsWith("/shop/")
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [buyerName, setBuyerName] = useState(() => read(localStorage, KEYS.name) || "");
  const [note, setNote] = useState("");
  const [lastOrder] = useState<{ id: string; statusPath: string } | null>(() => {
    try {
      const saved = JSON.parse(read(sessionStorage, KEYS.last(store.id)) || "null");
      return saved && typeof saved.id === "string" && typeof saved.statusPath === "string" &&
        saved.statusPath.startsWith("/shop/") && saved.at > Date.now() - 86_400_000
        ? saved
        : null;
    } catch {
      return null;
    }
  });

  useShopTheme(store.accent, `${store.name} · Katalog`);

  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return reconcileCart(JSON.parse(read(sessionStorage, KEYS.cart(store.id)) || "[]"), products);
    } catch {
      return [];
    }
  });
  useEffect(() => write(sessionStorage, KEYS.cart(store.id), JSON.stringify(cart)), [cart, store.id]);

  const view = params.get("view");
  const selected = products.find((p) => p.id === params.get("product"));
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [products],
  );
  const term = search.trim().toLocaleLowerCase("id-ID");
  const shown = products.filter(
    (p) => (!category || p.category === category) && `${p.name} ${p.description} ${p.category}`.toLocaleLowerCase("id-ID").includes(term),
  );
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartTotal(cart, products);
  const signature = orderSignature(store, products, cart);
  const statusPathOf = (id: string) => `/shop/${encodeURIComponent(slugOf(store))}/order/${id}`;

  function go(next: { product?: string; view?: string }, replace = false) {
    const search = new URLSearchParams(params);
    search.delete("product");
    search.delete("view");
    if (next.product) search.set("product", next.product);
    if (next.view) search.set("view", next.view);
    setParams(search, { replace });
    window.scrollTo({ top: 0 });
  }
  function add(product: CatalogProduct, option: string, quantity: number) {
    const exists = cart.some((l) => l.productId === product.id && l.option === option);
    if (!exists && cart.length >= MAX_ORDER_LINES) {
      setNotice(`Maksimal ${MAX_ORDER_LINES} produk berbeda per pesanan. Kirim pesanan ini dulu, lalu pesan lagi.`);
      return false;
    }
    setCart((previous) => reconcileCart([...previous, { productId: product.id, option, quantity }], products));
    setNotice(`${product.name} ditambahkan ke pesanan.`);
    setOrderError("");
    return true;
  }
  function changeQuantity(index: number, quantity: number) {
    setCart((previous) => previous.map((line, i) => (i === index ? { ...line, quantity } : line)));
    setReview(null);
  }
  function removeLine(index: number) {
    setCart((previous) => previous.filter((_, i) => i !== index));
    setReview(null);
  }

  async function send() {
    if (sendingRef.current) return;
    const name = buyerName.trim();
    if (!name) return setOrderError("Isi nama Anda supaya penjual tahu siapa yang memesan.");
    sendingRef.current = true;
    setSending(true);
    setOrderError("");
    // One ID per draft: a retry after a lost response finds the saved order instead of creating another.
    let draftId = read(sessionStorage, KEYS.draft(store.id));
    if (!draftId) {
      draftId = newOrderId(store.id);
      write(sessionStorage, KEYS.draft(store.id), draftId);
    }
    try {
      const result = await createOrderRequest(store.id, cart, name, note.trim(), signature, draftId);
      if ("closed" in result) {
        setClosed(true);
        return;
      }
      if ("changed" in result) {
        setReview({ products, lines: cart });
        setData(result.changed);
        setCart(result.cart);
        return;
      }
      write(localStorage, KEYS.name, name);
      write(sessionStorage, KEYS.draft(store.id), null);
      const statusPath = statusPathOf(result.id);
      const message = orderMessage(result.order, `${window.location.origin}${statusPath}`);
      const phone = result.order.shop?.whatsapp || store.whatsapp;
      const done: Placed = { id: result.id, statusPath, message, waUrl: whatsAppLink(phone, message) };
      setPlaced(done);
      write(sessionStorage, KEYS.placed(store.id), JSON.stringify(done));
      write(sessionStorage, KEYS.last(store.id), JSON.stringify({ id: result.id, statusPath, at: Date.now() }));
      setCart([]);
      setNote("");
      setReview(null);
      setFailed(false);
      go({ view: "terkirim" }, true);
    } catch {
      setFailed(true);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (closed)
    return (
      <ShopUnavailable
        title="Toko ini sedang tutup"
        body={`${store.name} belum menerima pesanan lewat katalog. Hubungi penjual langsung jika Anda punya nomornya.`}
      />
    );

  if (view === "terkirim" && placed) return <PlacedPage placed={placed} store={store} onBack={() => go({}, true)} />;

  if (selected)
    return (
      <ProductPage
        key={selected.id}
        product={selected}
        onBack={() => go({})}
        onAdd={(option, quantity) => {
          const ok = add(selected, option, quantity);
          if (ok) go({});
          return ok;
        }}
      />
    );

  if (view === "pesanan") {
    const backToShop = () => go({});
    // B7: nothing was saved, everything the buyer typed is kept.
    if (failed)
      return (
        <BuyerPage>
          <BuyerTopBar title="Pesanan saya" onBack={() => setFailed(false)} />
          <main className="flex flex-1 flex-col gap-3 p-4">
            <Callout role="alert" tone="danger" icon={<WifiOff className="mt-0.5 h-[19px] w-[19px] shrink-0" aria-hidden="true" />} className="p-4 text-sm">
              <strong>Pesanan belum terkirim.</strong>
              <br />
              Koneksi terputus saat menyimpan. WhatsApp tidak dibuka. Isian Anda masih tersimpan di sini, dan mencoba lagi tidak akan membuat pesanan ganda.
            </Callout>
            <div className="flex justify-between rounded-2xl bg-white p-3.5 text-sm">
              <span>{count} barang · {cart.length} produk</span>
              <strong className="num">{formatRupiah(total)}</strong>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-white p-3.5 text-sm">
              <span className="text-[12.5px] text-muted-foreground">Atas nama</span>
              <strong>{buyerName.trim()}</strong>
            </div>
          </main>
          <footer className="sticky bottom-0 border-t border-[#EEF1EC] bg-white px-4 pb-[max(1.875rem,env(safe-area-inset-bottom))] pt-3.5">
            <button
              type="button"
              disabled={sending}
              onClick={() => void send()}
              className={cn("flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-shop text-[15.5px] font-bold text-white disabled:opacity-80", focusRing)}
            >
              {sending ? <Loader2 className="h-[17px] w-[17px] animate-spin" aria-hidden="true" /> : <RotateCw className="h-[17px] w-[17px]" aria-hidden="true" />}
              {sending ? "Mengirim…" : "Coba kirim lagi"}
            </button>
          </footer>
        </BuyerPage>
      );

    return (
      <BuyerPage>
        <BuyerTopBar title="Pesanan saya" subtitle={store.name} onBack={backToShop} backLabel="Kembali ke katalog" />
        <main className="flex flex-1 flex-col gap-3 p-4">
          {review && (
            <Callout role="alert" tone="warning" icon={<RefreshCw className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />}>
              <strong>Ada yang berubah di katalog.</strong> Periksa lagi sebelum mengirim. Pesanan belum dikirim.
            </Callout>
          )}
          {cart.length === 0 && !review ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-4 py-10 text-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-semibold">Belum ada produk dipilih</p>
              <button type="button" onClick={backToShop} className={cn("h-11 rounded-xl border border-[#DFE4DC] px-4 text-sm font-semibold", focusRing)}>
                Lihat katalog
              </button>
            </div>
          ) : review ? (
            <ReviewLines review={review} products={products} cart={cart} />
          ) : (
            <OrderLines lines={cart} products={products} disabled={sending} onQuantity={changeQuantity} onRemove={removeLine} />
          )}
          {cart.length > 0 && !review && (
            <>
              <p className="flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
                <List className="h-[13px] w-[13px]" aria-hidden="true" />
                {cart.length} dari {MAX_ORDER_LINES} produk berbeda per pesanan
              </p>
              <div className="flex flex-col gap-3 rounded-2xl bg-white p-3.5">
                <label htmlFor="buyer-name" className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                  Nama Anda
                  <input
                    id="buyer-name"
                    autoComplete="name"
                    maxLength={60}
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="h-12 rounded-xl border border-input px-3.5 text-[15px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label htmlFor="buyer-note" className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                  <span>
                    Catatan untuk penjual <span className="font-normal text-muted-foreground">(opsional)</span>
                  </span>
                  <textarea
                    id="buyer-note"
                    rows={2}
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Alamat, warna, atau permintaan lain"
                    className="resize-none rounded-xl border border-input px-3.5 py-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
            </>
          )}
        </main>
        {cart.length > 0 && (
          <footer className="sticky bottom-0 flex flex-col gap-2.5 border-t border-[#EEF1EC] bg-white px-4 pb-[max(1.875rem,env(safe-area-inset-bottom))] pt-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{review ? "Subtotal baru" : `Subtotal · ${count} barang`}</span>
              <span className="num text-xl font-bold">{formatRupiah(total)}</span>
            </div>
            {!review && (
              <p className="text-xs leading-snug text-muted-foreground">
                Ongkir, stok, dan total akhir dikonfirmasi langsung oleh penjual. Belum ada pembayaran.
              </p>
            )}
            {orderError && <p role="alert" className="text-sm font-medium text-destructive">{orderError}</p>}
            <button
              type="button"
              disabled={sending}
              onClick={() => (review ? (setReview(null), void send()) : void send())}
              className={cn("flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-shop text-[15.5px] font-bold text-white disabled:opacity-80", focusRing)}
            >
              {sending ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
              ) : (
                !review && <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
              {sending ? "Menyimpan pesanan…" : review ? "Saya sudah cek, kirim pesanan" : "Kirim pesanan via WhatsApp"}
            </button>
          </footer>
        )}
      </BuyerPage>
    );
  }

  // B1: shop home
  return (
    <BuyerPage>
      <header className="flex flex-col gap-3.5 bg-shop-soft px-5 pb-[18px] pt-8 sm:rounded-b-3xl">
        <div className="flex items-center gap-3">
          <ShopAvatar name={store.name} logo={store.logo} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight">{store.name}</h1>
            <p className="flex items-center gap-1.5 text-[12.5px] text-[#3D4A42]">
              <span className="h-[7px] w-[7px] rounded-full bg-success" aria-hidden="true" />
              Menerima pesanan
            </p>
          </div>
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp}`}
              aria-label={`Hubungi ${store.name} via WhatsApp`}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-white text-shop", focusRing)}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
          )}
        </div>
        {store.description && (
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-normal text-[#3D4A42]">{store.description}</p>
        )}
        <label htmlFor="buyer-search" className="flex h-[46px] items-center gap-2.5 rounded-xl bg-white px-3.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
          <span className="sr-only">Cari produk</span>
          <input
            id="buyer-search"
            type="search"
            placeholder="Cari produk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>

      {lastOrder && (
        <a
          href={lastOrder.statusPath}
          className={cn("mx-5 mt-3.5 flex items-center justify-between gap-3 rounded-[14px] border border-dashed border-request/40 bg-request-soft/50 px-3.5 py-2.5 text-[13px]", focusRing)}
        >
          <span>
            Pesanan terakhir Anda <strong className="font-mono">#{orderCode(lastOrder.id)}</strong>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-shop-ink">
            Lihat status <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </a>
      )}

      {categories.length > 0 && (
        <nav aria-label="Kategori produk" className="flex gap-2 overflow-x-auto px-5 pb-1 pt-3.5 scrollbar-hide">
          {["", ...categories].map((value) => {
            const active = category === value;
            return (
              <button
                key={value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(value)}
                className={cn(
                  "flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px]",
                  active ? "bg-foreground font-semibold text-background" : "border border-[#DFE4DC] bg-white font-medium",
                  focusRing,
                )}
              >
                {value || `Semua · ${products.length}`}
              </button>
            );
          })}
        </nav>
      )}

      <main className="flex-1 px-5 pb-32 pt-3">
        <p role="status" className="sr-only">{notice}</p>
        {shown.length ? (
          <section aria-label="Produk katalog" className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-3">
            {shown.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                inCart={cart.filter((l) => l.productId === product.id).reduce((s, l) => s + l.quantity, 0)}
                onOpen={() => go({ product: product.id })}
              />
            ))}
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-8 text-center">
            <p className="font-semibold">{products.length ? "Produk tidak ditemukan" : "Produk segera hadir"}</p>
            <p className="text-sm text-muted-foreground">
              {products.length ? "Coba kata pencarian atau kategori lain." : "Penjual sedang menyiapkan produk untuk katalog ini."}
            </p>
            {(search || category) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                }}
                className={cn("mt-2 h-11 rounded-xl border border-[#DFE4DC] px-4 text-sm font-semibold", focusRing)}
              >
                Lihat semua produk
              </button>
            )}
          </div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Harga akhir, stok, ongkir, dan pembayaran dikonfirmasi langsung oleh penjual.
        </p>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              setOrderError("");
              go({ view: "pesanan" });
            }}
            className={cn(
              "mx-auto flex h-[60px] w-full max-w-[528px] items-center gap-3 rounded-2xl bg-shop pl-[18px] pr-2.5 text-left text-white shadow-[0_14px_30px_-10px_rgba(20,30,25,0.45)]",
              focusRing,
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs opacity-90">
                {count} produk · {cart.length} dari {MAX_ORDER_LINES} baris
              </span>
              <span className="num block text-base font-bold">{formatRupiah(total)}</span>
            </span>
            <span className="flex h-[42px] items-center gap-1.5 rounded-[11px] bg-white px-3.5 text-sm font-bold text-shop-ink">
              Lihat pesanan
              <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />
            </span>
          </button>
        </div>
      )}
    </BuyerPage>
  );
}

function CatalogLoader({ param }: { param: string }) {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    resolveStore(param)
      .then((id) => (id ? getPublicCatalog(id) : null))
      .then((value) => active && setData(value))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [param, retry]);
  useShopTheme(data?.store.accent, data ? `${data.store.name} · Katalog` : "Katalog");
  if (loading)
    return (
      <BuyerPage>
        <main role="status" className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Memuat katalog…
        </main>
      </BuyerPage>
    );
  if (error)
    return (
      <BuyerPage>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-[21px] font-bold">Katalog belum dapat dimuat</h1>
          <p className="text-sm text-muted-foreground">Periksa koneksi Anda lalu coba lagi.</p>
          <button
            type="button"
            onClick={() => setRetry((v) => v + 1)}
            className={cn("mt-2 h-12 rounded-[14px] bg-shop px-6 text-[15px] font-bold text-white", focusRing)}
          >
            Coba lagi
          </button>
        </main>
      </BuyerPage>
    );
  if (!data)
    return (
      <ShopUnavailable
        title="Toko ini sedang tutup"
        body="Toko belum menerima pesanan lewat katalog, atau tautannya tidak ditemukan. Hubungi penjual langsung jika Anda punya nomornya."
      />
    );
  return <CatalogView initial={data} />;
}

export function BuyerCatalog() {
  const { store } = useParams();
  return <CatalogLoader key={store} param={store || ""} />;
}
