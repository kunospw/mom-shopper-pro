import { Clock, Download, ShoppingBag } from "lucide-react";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog";
import { focusRing } from "@/components/shop/shop-ui";

export function priceRange(product: CatalogProduct) {
  const prices = product.options.length
    ? product.options.map((o) => (o.price > 0 ? o.price : product.price))
    : [product.price];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
/** "Rp 179.000 – 199.000" when options differ in price, else one price. */
export function priceLabel(product: CatalogProduct) {
  const { min, max } = priceRange(product);
  return min === max ? formatRupiah(min) : `${formatRupiah(min)} – ${max.toLocaleString("id-ID")}`;
}
/** Second line under the name: option count, digital delivery, or nothing. */
export function productMeta(product: CatalogProduct) {
  if (product.kind === "digital") return "Produk digital · dikirim via WA";
  if (product.options.length > 1) return `${product.options.length} ${product.optionLabel.toLocaleLowerCase("id-ID")}`;
  if (product.options.length === 1) return product.options[0].label;
  return "";
}

/** Small corner badge on the photo. Each carries text, not only a color. */
export function AvailabilityBadge({ product, className }: { product: CatalogProduct; className?: string }) {
  const base = "inline-flex items-center gap-1 rounded-md px-[7px] py-0.5 text-[10.5px] font-semibold";
  if (product.availability === "unavailable")
    return <span className={cn(base, "bg-muted text-[#3D4A42]", className)}>Belum tersedia</span>;
  if (product.availability === "preorder")
    return (
      <span className={cn(base, "bg-warning-soft text-warning", className)}>
        <Clock className="h-2.5 w-2.5" aria-hidden="true" />
        {product.leadTime ? `PO ${product.leadTime}` : "Preorder"}
      </span>
    );
  if (product.kind === "digital")
    return (
      <span className={cn(base, "bg-info-soft text-info", className)}>
        <Download className="h-2.5 w-2.5" aria-hidden="true" />
        Digital
      </span>
    );
  return (
    <span className={cn(base, "bg-white text-foreground", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
      Ready
    </span>
  );
}

/** B1 grid tile: square photo with status badge, name, meta, price; a bubble shows how many are in the order. */
export function ShopProductCard({
  product,
  inCart,
  onOpen,
}: {
  product: CatalogProduct;
  inCart: number;
  onOpen: () => void;
}) {
  const soldOut = product.availability === "unavailable";
  const meta = productMeta(product);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lihat ${product.name}${inCart ? `, ${inCart} di pesanan` : ""}`}
      className={cn("flex min-w-0 flex-col gap-1.5 rounded-[14px] text-left", soldOut && "opacity-60", focusRing)}
    >
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#F1EDE6]">
        {product.image ? (
          <img src={product.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <ShoppingBag className="h-10 w-10 text-[#8C7A68]/40" aria-hidden="true" />
        )}
        <AvailabilityBadge product={product} className="absolute left-2 top-2" />
        {inCart > 0 && (
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 flex h-[30px] min-w-[30px] items-center justify-center rounded-full bg-shop px-1.5 text-xs font-bold text-white"
          >
            {inCart}
          </span>
        )}
      </span>
      <span className="line-clamp-2 break-words text-[13.5px] font-semibold leading-tight">{product.name}</span>
      {meta && <span className="line-clamp-1 text-xs text-muted-foreground">{meta}</span>}
      <span className={cn("num text-[14.5px] font-bold", soldOut ? "text-foreground" : "text-shop-ink")}>{priceLabel(product)}</span>
    </button>
  );
}
