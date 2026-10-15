import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/currency";
import { availabilityLabels, type CatalogProduct } from "@/lib/catalog";
export function CatalogProductCard({
  product,
  onOpen,
}: {
  product: CatalogProduct;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lihat ${product.name}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-muted/50">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
        )}
        <Badge
          variant="secondary"
          className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] bg-card/95 text-card-foreground"
        >
          {availabilityLabels[product.availability]}
        </Badge>
      </div>
      <div className="w-full flex-1 space-y-2 p-4">
        {product.category && (
          <p className="truncate text-xs text-muted-foreground">
            {product.category}
          </p>
        )}
        <h2 className="break-words font-medium group-hover:text-primary">
          {product.name}
        </h2>
        <p className="font-semibold">{formatRupiah(product.price)}</p>
        {product.availability === "preorder" && (
          <p className="break-words text-xs text-muted-foreground">
            {product.leadTime}
          </p>
        )}
      </div>
    </button>
  );
}
