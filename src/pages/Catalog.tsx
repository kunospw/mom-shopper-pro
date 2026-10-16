import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Copy, ExternalLink, Pencil, Plus, Settings2, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBooks } from "@/contexts/BooksContext";
import { saveInventory } from "@/lib/books-storage";
import {
  getOwnerCatalog,
  saveCatalogProduct,
  deleteCatalogProduct,
  saveStorefront,
  isSlugAvailable,
} from "@/lib/catalog-owner-storage";
import type { CatalogProduct, Storefront, StorefrontFields } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ProductEditor } from "@/components/ProductEditor";
import { AvailabilityBadge, priceLabel, productMeta } from "@/components/ShopProductCard";
import { ShopAvatar } from "@/components/shop/shop-ui";
import { FilterChips, SearchBox, StatCard } from "@/components/form-parts";
import { SubscriptionNotice } from "@/components/SubscriptionNotice";
import { usePlan } from "@/hooks/use-plan";
import { canPublish, needsTrialStart } from "@/lib/entitlement";
import { StorefrontEditor } from "@/components/StorefrontEditor";
import { StoreSetup } from "@/components/StoreSetup";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatRupiah } from "@/lib/currency";
import { toast } from "sonner";
import { cn, formDialogClass } from "@/lib/utils";
import { effectiveAccentKey } from "@/lib/branding";
import type { Inventory } from "@/types/books";

/** Stock at or below this shows as "tinggal sedikit". */
const LOW_STOCK = 3;
const stockOf = (inventory: Inventory | undefined) => (typeof inventory?.stock === "number" ? inventory.stock : null);
const filters = [
  { id: "all", label: "Semua", test: () => true },
  { id: "shown", label: "Tampil", test: (p: CatalogProduct) => p.published },
  { id: "hidden", label: "Tersembunyi", test: (p: CatalogProduct) => !p.published },
  { id: "preorder", label: "Preorder", test: (p: CatalogProduct) => p.availability === "preorder" },
  { id: "low", label: "Stok menipis", test: (p: CatalogProduct, stock: number | null) => p.availability === "unavailable" || (stock !== null && stock <= LOW_STOCK) },
] as const;
type FilterId = (typeof filters)[number]["id"];

export function Catalog() {
  const { user } = useAuth();
  const books = useBooks();
  const { entitlement, plan, loaded: planLoaded, reload: reloadPlan, openUpgrade } = usePlan();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [store, setStore] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const edit = params.get("edit");
  const editor = params.get("new") === "product" || !!edit;
  const storeEditor = params.get("store") === "edit";
  const open = editor || storeEditor;
  const search = params.get("q") ?? "";
  const filter = (params.get("f") ?? "all") as FilterId;
  const [setupFlow, setSetupFlow] = useState(false);
  // A shop without a storefront gets the guided setup; it stays on it after saving to show the next step.
  const setup = storeEditor && (setupFlow || (!loading && !failed && !store));
  const selected = products.find((product) => product.id === edit);
  const blocker = useUnsavedChanges(open && (dirty || busy));
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    getOwnerCatalog()
      .then((data) => {
        if (active) {
          setStore(data.store);
          setProducts(data.products);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.uid, retry]);
  useEffect(() => {
    if (!open) setDirty(false);
  }, [open]);
  useEffect(() => {
    if (!storeEditor) setSetupFlow(false);
    else if (!loading && !failed && !store) setSetupFlow(true);
  }, [storeEditor, loading, failed, store]);
  function navigateEditor(key?: string, value?: string) {
    const next = new URLSearchParams(params);
    for (const name of ["new", "edit", "store"]) next.delete(name);
    if (key) next.set(key, value);
    setParams(next);
  }
  function done() {
    flushSync(() => {
      setDirty(false);
      setBusy(false);
    });
    const next = new URLSearchParams(params);
    for (const key of ["new", "edit", "store"]) next.delete(key);
    setParams(next, { replace: true });
  }
  const initialStore: StorefrontFields = store
    ? (({ id: _id, ...fields }) => fields)(store)
    : {
        name: user.businessName || "",
        description: "",
        whatsapp: "",
        accent: effectiveAccentKey(user.businessAccent),
        logo: user.businessLogo || "",
        published: false,
        slug: "",
      };
  const publicPath = `/shop/${encodeURIComponent(store?.slug || store?.id || user.uid)}`;
  const publicUrl = `${window.location.origin}${publicPath}`;
  async function togglePublished(product: CatalogProduct) {
    const { id, ...fields } = product;
    try {
      const saved = await saveCatalogProduct({ ...fields, published: !product.published }, id);
      setProducts((previous) => previous.map((p) => (p.id === id ? saved : p)));
      toast.success(saved.published ? `${product.name} ditampilkan` : `${product.name} disembunyikan`);
    } catch {
      toast.error("Status produk belum berubah. Coba lagi.");
    }
  }
  const categories = useMemo(() => [...new Set(products.map((p) => p.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [products]);
  const stockFor = (product: CatalogProduct) => stockOf(books.inventory[product.id]);
  const term = search.trim().toLocaleLowerCase("id-ID");
  const activeFilter = filters.find((f) => f.id === filter) ?? filters[0];
  const visible = products.filter(
    (product) =>
      activeFilter.test(product, stockFor(product)) &&
      `${product.name} ${product.category}`.toLocaleLowerCase("id-ID").includes(term),
  );
  const shownCount = products.filter((p) => p.published).length;
  const lowCount = products.filter((p) => filters[4].test(p, stockFor(p))).length;
  function setQuery(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Tautan katalog disalin");
    } catch {
      toast.error("Tautan belum tersalin. Salin dari kolom tautan publik.");
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Katalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">Produk yang dilihat pembeli di toko online. Modal dan stok hanya terlihat oleh Anda.</p>
        </div>
        <Button className="h-11 rounded-[10px]" disabled={loading || failed} onClick={() => navigateEditor("new", "product")}>
          <Plus />
          Tambah produk
        </Button>
      </header>
      {planLoaded && <SubscriptionNotice plan={plan} published={!!store?.published} />}
      {loading ? (
        <div role="status" aria-label="Memuat katalog" className="space-y-3">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
          </div>
          <p className="text-sm text-muted-foreground">Memuat katalog…</p>
        </div>
      ) : failed ? (
        <Card className="space-y-3 p-6">
          <p role="alert">Katalog belum dapat dimuat. Coba lagi atau hubungi pengelola aplikasi jika masalah berlanjut.</p>
          <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </Card>
      ) : (
        <>
          {store ? (
            <Card className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ShopAvatar name={store.name} logo={store.logo} size={48} ring={false} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold">{store.name || "Toko Anda"}</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", store.published ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", store.published ? "bg-success" : "bg-muted-foreground")} />
                      {store.published ? "Terbuka" : "Ditutup"}
                    </span>
                  </p>
                  {store.published ? (
                    <label htmlFor="public-catalog-url" className="mt-1 block min-w-0">
                      <span className="sr-only">Tautan publik</span>
                      <input
                        id="public-catalog-url"
                        readOnly
                        value={publicUrl}
                        onFocus={(event) => event.target.select()}
                        className="w-full min-w-0 truncate bg-transparent text-[13px] text-muted-foreground outline-none focus-visible:text-foreground"
                      />
                    </label>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted-foreground">Toko belum terlihat oleh pembeli. Buka dari Atur toko.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {store.published && (
                  <>
                    <Button variant="outline" onClick={() => void copyLink()}>
                      <Copy />
                      Salin tautan
                    </Button>
                    <Button asChild variant="outline">
                      <a href={publicPath} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        Lihat sebagai pembeli
                      </a>
                    </Button>
                  </>
                )}
                <Button variant={store.published ? "ghost" : "default"} onClick={() => navigateEditor("store", "edit")}>
                  <Settings2 />
                  Atur toko
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col gap-4 border-dashed p-5 sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary">
                <Store className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">Siapkan toko Anda</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Beri nama toko dan nomor WhatsApp pesanan. Sekitar 2 menit, lalu tambahkan produk.</p>
              </div>
              <Button onClick={() => navigateEditor("store", "edit")}>
                <Store />
                Buat toko
              </Button>
            </Card>
          )}

          {products.length > 0 && (
            <section aria-label="Ringkasan katalog" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Produk" value={products.length} hint={`${categories.length} kategori`} />
              <StatCard label="Tampil di toko" value={shownCount} hint={`${products.length - shownCount} tersembunyi`} />
              <StatCard label="Preorder" value={products.filter((p) => p.availability === "preorder").length} />
              <StatCard label="Stok menipis" value={lowCount} tone={lowCount ? "text-request" : undefined} hint={`Termasuk belum tersedia`} />
            </section>
          )}

          <Card className="overflow-hidden">
            {products.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-[18px]">
                <FilterChips
                  label="Saring produk"
                  value={activeFilter.id}
                  onChange={(value) => setQuery("f", value)}
                  options={filters.map((f) => ({ id: f.id, label: f.label, count: products.filter((p) => f.test(p, stockFor(p))).length }))}
                />
                <SearchBox id="owner-catalog-search" label="Cari produk" value={search} onChange={(value) => setQuery("q", value)} placeholder="Nama produk atau kategori" />
              </div>
            )}
            {!visible.length ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <ShoppingBag className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                <p className="font-semibold">{products.length ? "Produk tidak ditemukan" : "Belum ada produk"}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {products.length
                    ? "Coba kata pencarian atau saringan lain."
                    : "Tambahkan produk pertama dengan foto, harga, dan pilihan ukuran atau warna. Pembeli bisa langsung memesan dari toko."}
                </p>
                {products.length ? (
                  <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Tampilkan semua
                  </button>
                ) : (
                  <Button className="mt-2" onClick={() => navigateEditor("new", "product")}>
                    <Plus /> Tambah produk pertama
                  </Button>
                )}
              </div>
            ) : (
              <ul aria-label="Daftar produk" className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((product) => {
                  const stock = stockFor(product);
                  const cost = books.inventory[product.id]?.cost ?? 0;
                  const meta = [product.category, productMeta(product)].filter(Boolean).join(" · ");
                  return (
                    <li key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card">
                      <div className="flex min-w-0 gap-3 p-3 sm:flex-col sm:gap-0 sm:p-0">
                        <button
                          type="button"
                          onClick={() => navigateEditor("edit", product.id)}
                          tabIndex={-1}
                          aria-hidden="true"
                          className={cn("relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1EDE6] sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none", !product.published && "opacity-70")}
                        >
                          {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ShoppingBag className="h-8 w-8 text-[#8C7A68]/40" />}
                          <AvailabilityBadge product={product} className="absolute left-1.5 top-1.5 max-sm:hidden sm:left-2.5 sm:top-2.5" />
                        </button>
                        <div className="min-w-0 flex-1 sm:p-3.5">
                          <h2 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{product.name}</h2>
                          {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
                          <p className="num mt-1 font-bold">{priceLabel(product)}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <AvailabilityBadge product={product} className="border sm:hidden" />
                            {!product.published && <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">Tersembunyi</span>}
                            {stock !== null && (
                              <span className={cn("font-semibold", stock <= 0 ? "text-destructive" : stock <= LOW_STOCK ? "text-request" : "text-muted-foreground")}>
                                {stock <= 0 ? "Stok habis" : stock <= LOW_STOCK ? `Stok tinggal ${stock}` : `Stok ${stock}`}
                              </span>
                            )}
                            {cost > 0 && product.price > cost && <span className="num text-muted-foreground">Untung {formatRupiah(product.price - cost)}/unit</span>}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center gap-1 border-t px-2 py-1.5">
                        <label className="mr-auto flex min-h-11 cursor-pointer items-center gap-2 px-1.5 text-[13px] font-medium">
                          <Switch checked={product.published} onCheckedChange={() => void togglePublished(product)} aria-label={`Tampilkan ${product.name} di katalog`} />
                          <span aria-hidden="true">{product.published ? "Tampil" : "Sembunyi"}</span>
                        </label>
                        <Button variant="ghost" className="h-11" onClick={() => navigateEditor("edit", product.id)} aria-label={`Edit ${product.name}`}>
                          <Pencil />
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(product.id)} aria-label={`Hapus ${product.name}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {visible.length > 0 && (
              <p className="flex flex-wrap justify-between gap-2 border-t px-[18px] py-3 text-[13px] text-muted-foreground">
                <span>Menampilkan {visible.length} dari {products.length} produk</span>
                <span>Produk tersembunyi tidak terlihat oleh pembeli.</span>
              </p>
            )}
          </Card>
        </>
      )}

      <Dialog
        open={storeEditor && !loading && !failed}
        onOpenChange={(value) => {
          if (!value && !busy) navigateEditor();
        }}
      >
        <DialogContent
          className={formDialogClass}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {setup ? (
            <StoreSetup
              key="setup"
              initial={initialStore}
              trialLocked={planLoaded && !canPublish(plan, false)}
              trialStarts={planLoaded && !entitlement}
              onUpgrade={openUpgrade}
              checkSlug={isSlugAvailable}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onSave={async (fields) => {
                const saved = await saveStorefront(fields, store?.slug ?? "", {
                  startTrial: needsTrialStart(entitlement, fields.published),
                  reopening: fields.published && !store?.published,
                });
                setStore(saved);
                void reloadPlan();
                void books.reload();
                return saved;
              }}
              onFinish={(next) => {
                flushSync(() => {
                  setDirty(false);
                  setBusy(false);
                });
                if (next === "product") navigateEditor("new", "product");
                else done();
              }}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Toko publik</DialogTitle>
                <DialogDescription>Pilih informasi yang akan Anda bagikan kepada pembeli.</DialogDescription>
              </DialogHeader>
              <StorefrontEditor
                key="store"
                initial={initialStore}
                wasPublished={!!store?.published}
                trialLocked={planLoaded && !canPublish(plan, !!store?.published)}
                trialStarts={planLoaded && !entitlement}
                onUpgrade={openUpgrade}
                checkSlug={isSlugAvailable}
                onDirtyChange={setDirty}
                onBusyChange={setBusy}
                onCancel={() => navigateEditor()}
                onSave={async (fields) => {
                  setStore(
                    await saveStorefront(fields, store?.slug ?? "", {
                      startTrial: needsTrialStart(entitlement, fields.published),
                      reopening: fields.published && !store?.published,
                    }),
                  );
                  void reloadPlan();
                  void books.reload();
                  done();
                  toast.success("Pengaturan toko disimpan");
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={editor && !loading && !failed}
        onOpenChange={(value) => {
          if (!value && !busy) navigateEditor();
        }}
      >
        <SheetContent
          side="right"
          closeLabel="Tutup formulir"
          className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[1040px]"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <SheetHeader className="sticky top-0 z-10 border-b bg-card px-5 py-4 pr-16 text-left sm:px-7">
            <SheetTitle className="text-xl">{edit ? "Edit produk" : "Tambah produk"}</SheetTitle>
            <SheetDescription>Isi foto, harga, dan pilihan. Produk baru tersembunyi sampai Anda menampilkannya.</SheetDescription>
          </SheetHeader>
          <div className="p-4 sm:p-7">
            {edit && !selected ? (
              <p>Produk tidak ditemukan.</p>
            ) : (
              <ProductEditor
                key={edit || "new"}
                product={selected}
                inventory={selected ? books.inventory[selected.id] : undefined}
                categories={categories}
                onDirtyChange={setDirty}
                onBusyChange={setBusy}
                onCancel={() => navigateEditor()}
                onSave={async (fields, inventory) => {
                  const saved = await saveCatalogProduct(fields, edit || undefined);
                  try {
                    await saveInventory(saved.id, inventory);
                    void books.reload();
                  } catch {
                    toast.error("Produk tersimpan, tetapi modal dan stok belum. Buka produk lagi untuk menyimpannya.");
                  }
                  setProducts((previous) =>
                    [...previous.filter((product) => product.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "id")),
                  );
                  done();
                  toast.success("Produk disimpan");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(value) => {
          if (!value && !deleting) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {products.find((p) => p.id === deleteId)?.name ?? "produk"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk hilang dari katalog. Catatan transaksi yang sudah ada tetap
              tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (event) => {
                event.preventDefault();
                setDeleting(true);
                try {
                  await deleteCatalogProduct(deleteId);
                  setProducts((previous) =>
                    previous.filter((product) => product.id !== deleteId),
                  );
                  setDeleteId(null);
                  toast.success("Produk dihapus");
                } catch {
                  toast.error("Produk belum dihapus. Silakan coba lagi.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Menghapus…" : "Hapus produk"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
