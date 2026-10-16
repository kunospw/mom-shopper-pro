import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShopProductCard, availabilityTag } from "@/components/ShopProductCard";
import {
  createOrderRequest,
  getPublicCatalog,
  resolveStore,
} from "@/lib/catalog-public-storage";
import {
  cartTotal,
  optionPrice,
  orderCode,
  orderSignature,
  reconcileCart,
  whatsAppOrder,
  MAX_ORDER_LINES,
  type CartLine,
  type CatalogProduct,
  type Storefront,
} from "@/lib/catalog";
import { getAccent, isBusinessLogo } from "@/lib/branding";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";

type CatalogData = { store: Storefront; products: CatalogProduct[] };
type Placed = { id: string; waUrl: string; statusPath: string; name: string };
const slugOf = (store: Storefront) => store.slug || store.id;

function ProductSheet({
  product,
  onAdd,
}: {
  product: CatalogProduct;
  onAdd: (option: string, quantity: number) => void;
}) {
  const [option, setOption] = useState(product.options[0]?.label ?? "");
  const [quantity, setQuantity] = useState(1);
  const price = optionPrice(product, option);
  const tag = availabilityTag(product);
  const soldOut = product.availability === "unavailable";
  return (
    <div className="space-y-5">
      {product.image && (
        <img src={product.image} alt={product.name} className="max-h-72 w-full rounded-xl bg-muted object-contain" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num text-2xl font-semibold">{formatRupiah(price)}</p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{tag.label}</span>
      </div>
      {product.availability === "preorder" && product.leadTime && (
        <p className="rounded-lg border p-3 text-sm">Estimasi preorder: {product.leadTime}</p>
      )}
      {product.kind === "digital" && (
        <p className="rounded-lg border p-3 text-sm">Produk digital. Dikirim lewat WhatsApp setelah pembayaran dikonfirmasi.</p>
      )}
      {product.description && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{product.description}</p>
      )}
      {product.options.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{product.optionLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {product.options.map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={option === o.label}
                onClick={() => setOption(o.label)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  option === o.label
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "bg-card hover:bg-accent",
                )}
              >
                {o.label}
                {o.price > 0 && o.price !== product.price && (
                  <span className="num ml-1.5 text-xs text-muted-foreground">{formatRupiah(o.price)}</span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex items-center gap-3">
        <div role="group" aria-label="Jumlah" className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => setQuantity((q) => q - 1)}>
            <Minus />
          </Button>
          <span aria-live="polite" className="num w-10 text-center font-medium">{quantity}</span>
          <Button variant="outline" size="icon" disabled={quantity >= 99} aria-label="Tambah jumlah" onClick={() => setQuantity((q) => q + 1)}>
            <Plus />
          </Button>
        </div>
        <Button className="flex-1" size="lg" disabled={soldOut} onClick={() => onAdd(option, quantity)}>
          {soldOut ? "Belum tersedia" : `Tambah · ${formatRupiah(price * quantity)}`}
        </Button>
      </div>
    </div>
  );
}

function CatalogView({ initial }: { initial: CatalogData }) {
  const [data, setData] = useState(initial);
  const { store, products } = data;
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [closed, setClosed] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const nameKey = "ruang-usaha:buyer-name";
  const lastKey = `ruang-usaha:buyer-last:${store.id}`;
  const [buyerName, setBuyerName] = useState(() => {
    try {
      return localStorage.getItem(nameKey) || "";
    } catch {
      return "";
    }
  });
  const [note, setNote] = useState("");
  const [lastOrder, setLastOrder] = useState<Placed | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(lastKey) || "null");
      // Only trust a well-formed record pointing at our own shop or WhatsApp.
      return saved &&
        typeof saved.id === "string" &&
        typeof saved.statusPath === "string" &&
        saved.statusPath.startsWith("/shop/") &&
        typeof saved.waUrl === "string" &&
        saved.waUrl.startsWith("https://wa.me/") &&
        saved.at > Date.now() - 86_400_000
        ? saved
        : null;
    } catch {
      return null;
    }
  });

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--brand", getAccent(store.accent).color);
    document.title = `${store.name} · Katalog`;
  }, [store.accent, store.name]);

  const storageKey = `ruang-usaha:buyer-cart:${store.id}`;
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return reconcileCart(JSON.parse(sessionStorage.getItem(storageKey) || "[]"), products);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* The order continues in memory if session storage is unavailable. */
    }
  }, [cart, storageKey]);

  const selected = products.find((p) => p.id === params.get("product"));
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [products],
  );
  const shown = products.filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.name} ${p.description} ${p.category}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartTotal(cart, products);
  const signature = orderSignature(store, products, cart);

  function closeProduct() {
    const next = new URLSearchParams(params);
    next.delete("product");
    setParams(next, { replace: true });
  }
  function add(product: CatalogProduct, option: string, quantity: number) {
    const exists = cart.some((l) => l.productId === product.id && l.option === option);
    if (!exists && cart.length >= MAX_ORDER_LINES) {
      setNotice(`Maksimal ${MAX_ORDER_LINES} jenis produk per pesanan. Kirim pesanan ini dulu, lalu pesan lagi.`);
      return false;
    }
    setCart((previous) => reconcileCart([...previous, { productId: product.id, option, quantity }], products));
    setNotice(`${product.name} ditambahkan.`);
    setOrderError("");
    return true;
  }
  function changeQuantity(index: number, quantity: number) {
    setCart((previous) => previous.map((line, i) => (i === index ? { ...line, quantity } : line)));
  }

  async function send() {
    if (sending) return;
    const name = buyerName.trim();
    if (!name) return setOrderError("Isi nama Anda supaya penjual tahu siapa yang memesan.");
    setSending(true);
    setOrderError("");
    try {
      const result = await createOrderRequest(store.id, cart, name, note.trim(), signature);
      if ("closed" in result) {
        setClosed(true);
        setCartOpen(false);
        return;
      }
      if ("changed" in result) {
        setData(result.changed);
        setCart(result.cart);
        setOrderError("Ada perubahan harga atau ketersediaan. Periksa kembali pesanan Anda, lalu kirim lagi.");
        return;
      }
      try {
        localStorage.setItem(nameKey, name);
      } catch {
        /* Remembering the name is a convenience only. */
      }
      const statusPath = `/shop/${encodeURIComponent(slugOf(result.latest.store))}/order/${result.id}`;
      const waUrl = whatsAppOrder(result.latest.store, result.latest.products, result.cart, {
        id: result.id,
        buyerName: name,
        statusUrl: `${window.location.origin}${statusPath}`,
      });
      const done: Placed = { id: result.id, waUrl, statusPath, name };
      setPlaced(done);
      setLastOrder(done);
      setCart([]);
      setNote("");
      try {
        sessionStorage.setItem(lastKey, JSON.stringify({ ...done, at: Date.now() }));
      } catch {
        /* Ignore. */
      }
      // The order is saved first, so handing off to WhatsApp can never lose it.
      window.location.assign(waUrl);
    } catch {
      setOrderError("Pesanan belum terkirim. Periksa koneksi Anda; pilihan Anda masih tersimpan.");
    } finally {
      setSending(false);
    }
  }

  if (closed)
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-semibold">Katalog sedang tidak tersedia</h1>
        <p className="mt-3 text-muted-foreground">Toko sedang memperbarui katalognya. Silakan kembali nanti.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          {isBusinessLogo(store.logo) ? (
            <img src={store.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border bg-card object-contain p-1" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{store.name}</h1>
            <p className="text-sm text-muted-foreground">Pesan langsung lewat WhatsApp</p>
          </div>
        </div>
        {store.description && (
          <p className="mx-auto max-w-6xl whitespace-pre-wrap break-words px-4 pb-4 text-sm text-muted-foreground sm:px-6">
            {store.description}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {lastOrder && !placed && (
          <a
            href={lastOrder.statusPath}
            className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
          >
            <span>Pesanan terakhir Anda <strong>#{orderCode(lastOrder.id)}</strong></span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">Lihat status <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </a>
        )}
        <div className="space-y-3">
          <div className="relative">
            <Label htmlFor="buyer-search" className="sr-only">Cari di katalog</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="buyer-search"
              type="search"
              className="rounded-full pl-9"
              placeholder="Cari produk"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <nav aria-label="Kategori produk" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:px-0">
              {["", ...categories].map((value) => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    category === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  {value || "Semua"}
                </button>
              ))}
            </nav>
          )}
        </div>
        <p role="status" className="min-h-5 text-sm text-muted-foreground">{notice || `${shown.length} produk`}</p>
        {shown.length ? (
          <section aria-label="Produk katalog" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {shown.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                onOpen={() => {
                  const next = new URLSearchParams(params);
                  next.set("product", product.id);
                  setParams(next);
                }}
                onQuickAdd={
                  product.options.length === 0 ? () => add(product, "", 1) : () => {
                    const next = new URLSearchParams(params);
                    next.set("product", product.id);
                    setParams(next);
                  }
                }
              />
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="font-medium">{products.length ? "Produk tidak ditemukan" : "Produk segera hadir"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length ? "Coba kata pencarian atau kategori lain." : "Penjual sedang menyiapkan produk untuk katalog ini."}
            </p>
            {(search || category) && (
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setCategory(""); }}>
                Lihat semua produk
              </Button>
            )}
          </div>
        )}
        <footer className="border-t pt-6 text-xs text-muted-foreground">
          Harga akhir, stok, ongkir, dan pembayaran dikonfirmasi langsung oleh penjual.
        </footer>
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
          <button
            type="button"
            onClick={() => { setOrderError(""); setCartOpen(true); }}
            className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-3.5 text-primary-foreground shadow-pop transition-transform active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="text-sm font-medium">{count} barang · lihat pesanan</span>
            <span className="num font-semibold">{formatRupiah(total)}</span>
          </button>
        </div>
      )}

      <Dialog open={!!params.get("product")} onOpenChange={(open) => !open && closeProduct()}>
        <DialogContent className="max-h-[92dvh] w-full max-w-lg overflow-y-auto max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name || "Produk tidak tersedia"}</DialogTitle>
            <DialogDescription>{selected?.category || "Informasi produk"}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <ProductSheet
              key={selected.id}
              product={selected}
              onAdd={(option, quantity) => {
                if (add(selected, option, quantity)) closeProduct();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Produk mungkin sudah tidak ditampilkan. Silakan pilih produk lain.</p>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={cartOpen || !!placed} onOpenChange={(open) => { if (!open) { setCartOpen(false); setPlaced(null); } }}>
        <SheetContent side="bottom" closeLabel="Tutup" className="flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl p-4 pt-6 sm:mx-auto sm:max-w-lg">
          {placed ? (
            <div className="space-y-4 py-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="h-7 w-7" aria-hidden="true" />
              </span>
              <SheetHeader className="text-center">
                <SheetTitle>Pesanan #{orderCode(placed.id)} tercatat</SheetTitle>
                <SheetDescription>
                  Lanjutkan di WhatsApp supaya penjual bisa langsung mengonfirmasi. Anda bisa memantau statusnya kapan saja.
                </SheetDescription>
              </SheetHeader>
              <Button asChild size="lg" className="w-full">
                <a href={placed.waUrl}>Buka WhatsApp <ArrowRight /></a>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href={placed.statusPath}>Lihat status pesanan</a>
              </Button>
            </div>
          ) : (
            <>
              <SheetHeader className="pr-12 text-left">
                <SheetTitle>Pesanan Anda</SheetTitle>
                <SheetDescription>Periksa, isi nama, lalu kirim lewat WhatsApp.</SheetDescription>
              </SheetHeader>
              <ul className="mt-4 space-y-3">
                {cart.map((line, index) => {
                  const product = products.find((p) => p.id === line.productId);
                  if (!product) return null;
                  const unit = optionPrice(product, line.option);
                  return (
                    <li key={`${line.productId}-${line.option}`} className="flex items-start gap-3 rounded-xl border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium">{product.name}</p>
                        {line.option && <p className="text-xs text-muted-foreground">{product.optionLabel}: {line.option}</p>}
                        <p className="num mt-1 text-sm">{formatRupiah(unit)}</p>
                        <div role="group" aria-label={`Jumlah ${product.name}`} className="mt-2 flex items-center gap-1">
                          <Button variant="outline" size="icon" aria-label={`Kurangi ${product.name}`} disabled={sending || line.quantity <= 1} onClick={() => changeQuantity(index, line.quantity - 1)}><Minus /></Button>
                          <span className="num w-9 text-center text-sm font-medium">{line.quantity}</span>
                          <Button variant="outline" size="icon" aria-label={`Tambah ${product.name}`} disabled={sending || line.quantity >= 99} onClick={() => changeQuantity(index, line.quantity + 1)}><Plus /></Button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button variant="ghost" size="icon" disabled={sending} aria-label={`Hapus ${product.name}`} onClick={() => setCart((previous) => previous.filter((_, i) => i !== index))}><X /></Button>
                        <p className="num text-sm font-semibold">{formatRupiah(unit * line.quantity)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {cart.length === 0 && (
                <div className="space-y-3 py-8 text-center">
                  <p>Belum ada produk dipilih.</p>
                  <Button variant="outline" onClick={() => setCartOpen(false)}>Lihat katalog</Button>
                </div>
              )}
              {cart.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="buyer-name">Nama Anda</Label>
                    <Input id="buyer-name" autoComplete="name" maxLength={60} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer-note">Catatan untuk penjual (opsional)</Label>
                    <Textarea id="buyer-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alamat, warna, atau permintaan lain" />
                  </div>
                  <div className="flex items-center justify-between border-t pt-3 font-semibold">
                    <span>Subtotal</span>
                    <span className="num text-lg">{formatRupiah(total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Belum termasuk ongkir. Ini permintaan pesanan, bukan pembayaran. Penjual mengonfirmasi stok dan total akhir.
                  </p>
                  {orderError && <p role="alert" className="text-sm font-medium text-destructive">{orderError}</p>}
                  <Button size="lg" className="w-full" disabled={sending} onClick={() => void send()}>
                    {sending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    {sending ? "Mengirim…" : "Kirim pesanan via WhatsApp"}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
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
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.removeProperty("font-size");
    root.style.colorScheme = "light";
    root.style.setProperty("--brand", getAccent(data?.store.accent).color);
    document.title = data ? `${data.store.name} · Katalog` : "Katalog";
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("color-scheme");
    };
  }, [data]);
  if (loading)
    return <main role="status" className="mx-auto max-w-lg p-8 text-center">Memuat katalog…</main>;
  if (error)
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Katalog belum dapat dimuat</h1>
        <p className="text-muted-foreground">Periksa koneksi Anda lalu coba lagi.</p>
        <Button onClick={() => setRetry((v) => v + 1)}>Coba lagi</Button>
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <ShoppingBag className="mx-auto text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Katalog sedang tidak tersedia</h1>
        <p className="text-muted-foreground">Toko belum dibuka atau tautan tidak tersedia. Silakan hubungi penjual.</p>
      </main>
    );
  return <CatalogView initial={data} />;
}

export function BuyerCatalog() {
  const { store } = useParams();
  return <CatalogLoader key={store} param={store || ""} />;
}
