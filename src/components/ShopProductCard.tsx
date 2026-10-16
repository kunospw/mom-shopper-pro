import { Plus, ShoppingBag } from "lucide-react";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog";

export function priceFrom(product: CatalogProduct) {
  const prices = [
    product.price,
    ...product.options.map((o) => (o.price > 0 ? o.price : product.price)),
  ];
  const min = Math.min(...prices);
  return { min, varies: prices.some((p) => p !== min) };
}
export function availabilityTag(product: CatalogProduct) {
  if (product.availability === "unavailable") return { label: "Habis", tone: "danger" as const };
  if (product.availability === "preorder") return { label: "Preorder", tone: "warning" as const };
  if (product.kind === "digital") return { label: "Digital", tone: "info" as const };
  return { label: "Ready", tone: "success" as const };
}
const tones = {
  danger: "bg-destructive text-destructive-foreground",
  warning: "bg-pending text-pending-foreground",
  info: "bg-foreground text-background",
  success: "bg-card/95 text-foreground",
} as const;

export function ShopProductCard({
  product,
  onOpen,
  onQuickAdd,
}: {
  product: CatalogProduct;
  onOpen: () => void;
  onQuickAdd?: () => void;
}) {
  const tag = availabilityTag(product);
  const { min, varies } = priceFrom(product);
  const soldOut = product.availability === "unavailable";
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-pop">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Lihat ${product.name}`}
        className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted/60">
          {product.image ? (
            <img
              src={product.image}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn("h-full w-full object-cover", soldOut && "opacity-50 grayscale")}
            />
          ) : (
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          )}
          <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm", tones[tag.tone])}>
            {tag.label}
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3 pr-14">
          <span className="line-clamp-2 break-words text-sm font-medium leading-snug">{product.name}</span>
          <span className="num flex flex-wrap items-baseline gap-x-1 text-sm font-semibold">
            {varies && <span className="text-xs font-normal text-muted-foreground">mulai</span>}
            <span>{formatRupiah(min)}</span>
          </span>
          {product.availability === "preorder" && product.leadTime && (
            <span className="line-clamp-1 text-xs text-muted-foreground">{product.leadTime}</span>
          )}
        </span>
      </button>
      {onQuickAdd && !soldOut && (
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label={`Tambah ${product.name} ke pesanan`}
          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop transition-transform active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
