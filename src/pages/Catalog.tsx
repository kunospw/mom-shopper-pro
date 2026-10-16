import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ShoppingBag,
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  Settings2,
} from "lucide-react";
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
import {
  availabilityLabels,
  type CatalogProduct,
  type Storefront,
  type StorefrontFields,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { StorefrontEditor } from "@/components/StorefrontEditor";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatRupiah } from "@/lib/currency";
import { toast } from "sonner";
import { formDialogClass } from "@/lib/utils";
import { effectiveAccentKey } from "@/lib/branding";

export function Catalog() {
  const { user } = useAuth();
  const books = useBooks();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [store, setStore] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const edit = params.get("edit");
  const editor = params.get("new") === "product" || !!edit;
  const storeEditor = params.get("store") === "edit";
  const open = editor || storeEditor;
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
  const visible = products.filter((product) =>
    `${product.name} ${product.category}`
      .toLocaleLowerCase("id-ID")
      .includes(search.trim().toLocaleLowerCase("id-ID")),
  );
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Katalog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kelola produk untuk pembeli. Daftar ini terpisah dari catatan
            transaksi.
          </p>
        </div>
        <Button
          disabled={loading || failed}
          onClick={() => navigateEditor("new", "product")}
        >
          <Plus />
          Tambah produk
        </Button>
      </header>
      {loading ? (
        <p role="status">Memuat katalog…</p>
      ) : failed ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p role="alert">
              Katalog belum dapat dimuat. Coba lagi atau hubungi pengelola
              aplikasi jika masalah berlanjut.
            </p>
            <Button
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {store?.name || "Siapkan toko Anda"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {store?.published
                      ? "Katalog terbuka. Hanya produk yang ditampilkan dapat dilihat pembeli."
                      : "Katalog masih ditutup. Lengkapi informasi toko, tambahkan produk, lalu buka untuk pembeli."}
                  </p>
                </div>
                <Badge variant={store?.published ? "success" : "neutral"}>
                  {store?.published ? "Terbuka" : "Ditutup"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigateEditor("store", "edit")}
                >
                  <Settings2 />
                  Atur toko
                </Button>
                {store?.published && (
                  <>
                    <Button asChild variant="outline">
                      <a
                        href={publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink />
                        Lihat sebagai pembeli
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicUrl);
                          toast.success("Tautan katalog disalin");
                        } catch {
                          toast.error(
                            "Tautan belum tersalin. Salin dari kolom tautan publik.",
                          );
                        }
                      }}
                    >
                      <Copy />
                      Salin tautan
                    </Button>
                  </>
                )}
              </div>
              {store?.published && (
                <div className="space-y-2">
                  <Label htmlFor="public-catalog-url">Tautan publik</Label>
                  <Input
                    id="public-catalog-url"
                    readOnly
                    value={publicUrl}
                    onFocus={(event) => event.target.select()}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Label htmlFor="owner-catalog-search">Cari produk</Label>
            <Input
              id="owner-catalog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama produk atau kategori"
            />
          </div>
          {!visible.length ? (
            <Card>
              <CardContent className="space-y-3 p-8 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="font-medium">
                  {products.length
                    ? "Produk tidak ditemukan"
                    : "Belum ada produk katalog"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {products.length
                    ? "Coba kata pencarian lain."
                    : "Tambahkan produk pertama. Produk baru disimpan sebagai tersembunyi sampai Anda memilih untuk menampilkannya."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((product) => (
                <Card key={product.id}>
                  <CardContent className="flex min-w-0 gap-4 p-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ShoppingBag className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-medium">
                        {product.name}
                      </h2>
                      <p className="mt-1 text-sm">
                        {formatRupiah(product.price)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={product.published ? "success" : "neutral"}>
                          {product.published ? "Ditampilkan" : "Tersembunyi"}
                        </Badge>
                        <Badge variant="outline">
                          {availabilityLabels[product.availability]}
                        </Badge>
                        {product.kind === "digital" && <Badge variant="outline">Digital</Badge>}
                        {typeof books.inventory[product.id]?.stock === "number" && (
                          <Badge variant={books.inventory[product.id].stock! <= 0 ? "danger" : "neutral"}>
                            Stok {books.inventory[product.id].stock}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigateEditor("edit", product.id)}
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <Switch
                            checked={product.published}
                            onCheckedChange={() => void togglePublished(product)}
                            aria-label={`Tampilkan ${product.name} di katalog`}
                          />
                          Tampil
                        </label>
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteId(product.id)}
                          aria-label={`Hapus ${product.name}`}
                        >
                          <Trash2 />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog
        open={open && !loading && !failed}
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
          <DialogHeader>
            <DialogTitle>
              {storeEditor
                ? "Toko publik"
                : edit
                  ? "Edit produk"
                  : "Tambah produk"}
            </DialogTitle>
            <DialogDescription>
              {storeEditor
                ? "Pilih informasi yang akan Anda bagikan kepada pembeli."
                : "Isi informasi produk dan tentukan apakah produk ditampilkan kepada pembeli."}
            </DialogDescription>
          </DialogHeader>
          {storeEditor ? (
            <StorefrontEditor
              key="store"
              initial={initialStore}
              checkSlug={isSlugAvailable}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onCancel={() => navigateEditor()}
              onSave={async (fields) => {
                setStore(await saveStorefront(fields, store?.slug ?? ""));
                void books.reload();
                done();
                toast.success("Pengaturan toko disimpan");
              }}
            />
          ) : edit && !selected ? (
            <p>Produk tidak ditemukan.</p>
          ) : (
            <ProductEditor
              key={edit || "new"}
              product={selected}
              inventory={selected ? books.inventory[selected.id] : undefined}
              onDirtyChange={setDirty}
              onBusyChange={setBusy}
              onCancel={() => navigateEditor()}
              onSave={async (fields, inventory) => {
                const saved = await saveCatalogProduct(
                  fields,
                  edit || undefined,
                );
                try {
                  await saveInventory(saved.id, inventory);
                  void books.reload();
                } catch {
                  toast.error(
                    "Produk tersimpan, tetapi modal dan stok belum. Buka produk lagi untuk menyimpannya.",
                  );
                }
                setProducts((previous) =>
                  [
                    ...previous.filter((product) => product.id !== saved.id),
                    saved,
                  ].sort((a, b) => a.name.localeCompare(b.name, "id")),
                );
                done();
                toast.success("Produk disimpan");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(value) => {
          if (!value && !deleting) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk katalog?</AlertDialogTitle>
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
