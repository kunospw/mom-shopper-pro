import { useEffect, useLayoutEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { getPublicCatalog } from "@/lib/catalog-public-storage";
import {
  availabilityLabels,
  cartTotal,
  reconcileCart,
  orderSignature,
  whatsAppOrder,
  storeIdSchema,
  type Storefront,
  type CatalogProduct,
  type CartLine,
} from "@/lib/catalog";
import { getAccent, isBusinessLogo } from "@/lib/branding";
import { formatRupiah } from "@/lib/currency";

type CatalogData = { store: Storefront; products: CatalogProduct[] };
function ProductDetails({
  product,
  add,
}: {
  product: CatalogProduct;
  add: (option: string, quantity: number) => void;
}) {
  const [option, setOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="space-y-4">
      {product.image && (
        <img
          src={product.image}
          alt={product.name}
          className="max-h-80 w-full rounded-lg bg-muted object-contain"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-semibold">{formatRupiah(product.price)}</p>
        <Badge variant="secondary">
          {availabilityLabels[product.availability]}
        </Badge>
      </div>
      {product.description && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>
      )}
      {product.availability === "preorder" && (
        <p className="rounded-lg border p-3 text-sm">
          Estimasi preorder: {product.leadTime}
        </p>
      )}
      {product.options.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="buyer-option">{product.optionLabel}</Label>
          <Select value={option} onValueChange={setOption}>
            <SelectTrigger id="buyer-option">
              <SelectValue
                placeholder={`Pilih ${product.optionLabel.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              {product.options.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="buyer-quantity">Jumlah</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={quantity <= 1}
            aria-label="Kurangi jumlah"
            onClick={() => setQuantity((value) => value - 1)}
          >
            <Minus />
          </Button>
          <Input
            id="buyer-quantity"
            className="w-20 text-center"
            type="number"
            min={1}
            max={99}
            step={1}
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Math.max(
                  1,
                  Math.min(99, Math.trunc(Number(event.target.value)) || 1),
                ),
              )
            }
          />
          <Button
            variant="outline"
            size="icon"
            disabled={quantity >= 99}
            aria-label="Tambah jumlah"
            onClick={() => setQuantity((value) => value + 1)}
          >
            <Plus />
          </Button>
        </div>
      </div>
      <Button
        className="w-full"
        disabled={
          product.availability === "unavailable" ||
          (product.options.length > 0 && !option)
        }
        onClick={() => add(option, quantity)}
      >
        <ShoppingCart />
        {product.availability === "unavailable"
          ? "Belum tersedia"
          : "Tambahkan ke pilihan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Stok, harga akhir, dan waktu pengiriman dikonfirmasi oleh penjual.
      </p>
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
  const [checking, setChecking] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [closed, setClosed] = useState(false);
  const [prepared, setPrepared] = useState<{
    signature: string;
    url: string;
  } | null>(null);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--brand",
      getAccent(store.accent).color,
    );
    document.title = `${store.name} · Katalog`;
  }, [store.accent, store.name]);
  const storageKey = `ruang-usaha:buyer-cart:${store.id}`;
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return reconcileCart(
        JSON.parse(sessionStorage.getItem(storageKey) || "[]"),
        products,
      );
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* Browsing and ordering continue in memory if session storage is unavailable. */
    }
  }, [cart, storageKey]);
  const selected = products.find(
    (product) => product.id === params.get("product"),
  );
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "id"));
  const shown = products.filter(
    (product) =>
      (!category || product.category === category) &&
      `${product.name} ${product.description} ${product.category}`
        .toLocaleLowerCase("id-ID")
        .includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  const currentSignature = orderSignature(store, products, cart);
  const readyUrl =
    prepared?.signature === currentSignature ? prepared.url : null;
  function closeProduct() {
    const next = new URLSearchParams(params);
    next.delete("product");
    setParams(next, { replace: true });
  }
  function changeQuantity(index: number, quantity: number) {
    setCart((previous) =>
      previous.map((line, i) => (i === index ? { ...line, quantity } : line)),
    );
  }
  async function prepare() {
    if (checking) return;
    setChecking(true);
    setOrderError("");
    setPrepared(null);
    try {
      const latest = await getPublicCatalog(store.id);
      if (!latest) {
        setClosed(true);
        setCartOpen(false);
        return;
      }
      const updatedCart = reconcileCart(cart, latest.products);
      const latestSignature = orderSignature(
        latest.store,
        latest.products,
        updatedCart,
      );
      setData(latest);
      setCart(updatedCart);
      if (currentSignature !== latestSignature) {
        setOrderError(
          "Ada perubahan produk, harga, atau ketersediaan. Tinjau kembali pilihan Anda, lalu periksa pesanan lagi.",
        );
        return;
      }
      setPrepared({
        signature: latestSignature,
        url: whatsAppOrder(latest.store, latest.products, updatedCart),
      });
    } catch {
      setOrderError(
        "Pesanan belum dapat diperiksa. Pilihan Anda tetap tersedia; silakan coba lagi.",
      );
    } finally {
      setChecking(false);
    }
  }
  if (closed)
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-semibold">
          Katalog sedang tidak tersedia
        </h1>
        <p className="mt-3 text-muted-foreground">
          Toko sedang memperbarui katalognya. Silakan kembali nanti.
        </p>
      </div>
    );
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href={`/shop/${encodeURIComponent(store.id)}`}
            className="flex min-w-0 items-center gap-3"
          >
            {isBusinessLogo(store.logo) ? (
              <img
                src={store.logo}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border object-contain p-1"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShoppingBag />
              </span>
            )}
            <span className="truncate font-semibold">{store.name}</span>
          </a>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => {
              setOrderError("");
              setPrepared(null);
              setCartOpen(true);
            }}
            aria-label={`Pilihan pesanan, ${cart.reduce((sum, line) => sum + line.quantity, 0)} barang`}
          >
            <ShoppingCart />
            <span className="hidden sm:inline">Pilihan</span>
            <span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="max-w-2xl space-y-3">
          <p className="text-sm text-primary">Katalog {store.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Temukan pilihan Anda.
          </h1>
          {store.description && (
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              {store.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Pilih produk, lalu kirim permintaan melalui WhatsApp. Penjual akan
            mengonfirmasi pesanan Anda.
          </p>
        </section>
        <div className="max-w-lg space-y-2">
          <Label htmlFor="buyer-search">Cari di katalog</Label>
          <Input
            id="buyer-search"
            type="search"
            placeholder="Cari nama produk atau kategori"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <nav aria-label="Kategori produk" className="flex flex-wrap gap-2">
            <Button
              variant={!category ? "secondary" : "ghost"}
              aria-pressed={!category}
              onClick={() => setCategory("")}
            >
              Semua
            </Button>
            {categories.map((value) => (
              <Button
                key={value}
                className="h-auto min-h-11 max-w-full whitespace-normal break-words"
                variant={category === value ? "secondary" : "ghost"}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {value}
              </Button>
            ))}
          </nav>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {notice || `${shown.length} produk`}
        </p>
        {shown.length ? (
          <section
            aria-label="Produk katalog"
            className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          >
            {shown.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                onOpen={() => {
                  const next = new URLSearchParams(params);
                  next.set("product", product.id);
                  setParams(next);
                }}
              />
            ))}
          </section>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <p className="font-medium">
                {products.length
                  ? "Produk tidak ditemukan"
                  : "Produk segera hadir"}
              </p>
              <p className="text-sm text-muted-foreground">
                {products.length
                  ? "Coba kata pencarian atau kategori lain."
                  : "Penjual sedang menyiapkan produk untuk katalog ini."}
              </p>
              {(search || category) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setCategory("");
                  }}
                >
                  Lihat semua produk
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        <footer className="border-t pt-6 text-xs text-muted-foreground">
          Pemesanan, pembayaran, dan pengiriman dikonfirmasi langsung dengan
          penjual.{" "}
          <a href="/login" className="ml-1 underline underline-offset-4">
            Masuk sebagai pemilik toko
          </a>
        </footer>
      </main>
      <Dialog
        open={!!params.get("product")}
        onOpenChange={(value) => {
          if (!value) closeProduct();
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg min-w-0 grid-cols-[minmax(0,1fr)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.name || "Produk tidak tersedia"}
            </DialogTitle>
            <DialogDescription>
              {selected?.category || "Informasi produk"}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <ProductDetails
              key={selected.id}
              product={selected}
              add={(option, quantity) => {
                const exists = cart.some(
                  (line) =>
                    line.productId === selected.id && line.option === option,
                );
                if (!exists && cart.length >= 10) {
                  setNotice(
                    "Maksimal 10 pilihan per permintaan. Kirim permintaan ini terlebih dahulu.",
                  );
                  closeProduct();
                  return;
                }
                setCart((previous) =>
                  reconcileCart(
                    [...previous, { productId: selected.id, option, quantity }],
                    products,
                  ),
                );
                setNotice(`${selected.name} ditambahkan ke pilihan Anda.`);
                setPrepared(null);
                closeProduct();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Produk mungkin sudah tidak ditampilkan. Silakan pilih produk lain.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          closeLabel="Tutup pilihan pesanan"
          className="flex h-dvh w-full max-w-full flex-col overflow-y-auto p-4 pt-6 sm:max-w-lg"
        >
          <SheetHeader className="pr-12 text-left">
            <SheetTitle>Pilihan pesanan</SheetTitle>
            <SheetDescription>
              Tinjau produk sebelum menghubungi penjual.
            </SheetDescription>
          </SheetHeader>
          {!cart.length ? (
            <div className="space-y-3 py-8 text-center">
              <ShoppingCart className="mx-auto text-muted-foreground" />
              <p>Belum ada produk dipilih.</p>
              <Button variant="outline" onClick={() => setCartOpen(false)}>
                Lanjut melihat katalog
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {cart.map((line, index) => {
                  const product = products.find(
                    (item) => item.id === line.productId,
                  );
                  return (
                    <div
                      key={`${line.productId}-${line.option}`}
                      className="space-y-3 rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {product.name}
                          </p>
                          {line.option && (
                            <p className="break-words text-sm text-muted-foreground">
                              {product.optionLabel}: {line.option}
                            </p>
                          )}
                          <p className="mt-1 text-sm">
                            {formatRupiah(product.price)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {availabilityLabels[product.availability]}
                            {product.availability === "preorder"
                              ? ` · ${product.leadTime}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          disabled={checking}
                          aria-label={`Hapus ${product.name} dari pilihan`}
                          onClick={() =>
                            setCart((previous) =>
                              previous.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Kurangi ${product.name}`}
                          disabled={checking || line.quantity <= 1}
                          onClick={() =>
                            changeQuantity(index, line.quantity - 1)
                          }
                        >
                          <Minus />
                        </Button>
                        <span
                          className="min-w-10 text-center"
                          aria-label={`Jumlah ${product.name}`}
                        >
                          {line.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Tambah ${product.name}`}
                          disabled={checking || line.quantity >= 99}
                          onClick={() =>
                            changeQuantity(index, line.quantity + 1)
                          }
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto space-y-3 border-t pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span>Subtotal produk</span>
                  <span>{formatRupiah(cartTotal(cart, products))}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Belum termasuk ongkir. Ini permintaan pesanan, belum
                  pembayaran. Penjual mengonfirmasi ketersediaan dan total
                  akhir.
                </p>
                {orderError && (
                  <p role="alert" className="text-sm text-destructive">
                    {orderError}
                  </p>
                )}
                {readyUrl ? (
                  <>
                    <p role="status" className="text-sm">
                      Pilihan sudah diperiksa. Kirim pesan untuk mengajukan
                      pesanan.
                    </p>
                    <Button asChild className="w-full">
                      <a
                        href={readyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buka WhatsApp
                        <ArrowRight />
                      </a>
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full"
                    disabled={checking}
                    onClick={() => {
                      void prepare();
                    }}
                  >
                    {checking ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ArrowRight />
                    )}
                    {checking ? "Memeriksa produk…" : "Periksa & lanjutkan"}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
function CatalogLoader({ storeId }: { storeId: string }) {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    if (!storeIdSchema.safeParse(storeId).success) {
      setData(null);
      setLoading(false);
      return;
    }
    getPublicCatalog(storeId)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId, retry]);
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
    return (
      <main role="status" className="mx-auto max-w-lg p-8 text-center">
        Memuat katalog…
      </main>
    );
  if (error)
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Katalog belum dapat dimuat</h1>
        <p className="text-muted-foreground">
          Periksa koneksi Anda lalu coba lagi.
        </p>
        <Button onClick={() => setRetry((value) => value + 1)}>
          Coba lagi
        </Button>
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <ShoppingBag className="mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Katalog sedang tidak tersedia
        </h1>
        <p className="text-muted-foreground">
          Toko belum dibuka atau tautan tidak tersedia. Silakan hubungi penjual.
        </p>
      </main>
    );
  return <CatalogView initial={data} />;
}
export function BuyerCatalog() {
  const { storeId } = useParams();
  return <CatalogLoader key={storeId} storeId={storeId || ""} />;
}
