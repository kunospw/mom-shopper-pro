import { optionPrice, type CatalogProduct, type Storefront } from "./catalog";

export type PromoTemplate = "new" | "promo" | "preorder" | "restock";
export const promoTemplates: { id: PromoTemplate; label: string }[] = [
  { id: "new", label: "Produk baru" },
  { id: "promo", label: "Promo" },
  { id: "preorder", label: "PO dibuka" },
  { id: "restock", label: "Restock" },
];
/** Products per broadcast: enough to show, few enough to read on a phone. */
export const MAX_PROMO_PRODUCTS = 6;
/** WhatsApp status text is cut off around 700 characters. */
export const STATUS_LIMIT = 700;

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
export function promoPrice(product: CatalogProduct) {
  const prices = product.options.length ? product.options.map((o) => optionPrice(product, o.label)) : [product.price];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? rp(min) : `${rp(min)} – ${max.toLocaleString("id-ID")}`;
}
export function shopLink(store: Pick<Storefront, "id" | "slug">, origin: string) {
  return `${origin}/shop/${encodeURIComponent(store.slug || store.id)}`;
}
export function productLink(store: Pick<Storefront, "id" | "slug">, product: Pick<CatalogProduct, "id">, origin: string) {
  return `${shopLink(store, origin)}?product=${encodeURIComponent(product.id)}`;
}

const intro: Record<PromoTemplate, (shop: string) => string> = {
  new: (shop) => `✨ Produk baru di ${shop}!`,
  promo: (shop) => `🎉 Promo spesial dari ${shop}!`,
  preorder: (shop) => `📦 PO dibuka di ${shop}!`,
  restock: (shop) => `🔁 Restock di ${shop}!`,
};
const closing: Record<PromoTemplate, string> = {
  new: "Pesan langsung dari katalog, nanti dikonfirmasi lewat WhatsApp ya.",
  promo: "Stok terbatas, pesan sekarang lewat katalog sebelum kehabisan.",
  preorder: "Kuota PO terbatas. Pesan lewat katalog, pembayaran dikonfirmasi lewat WhatsApp.",
  restock: "Sudah tersedia lagi! Pesan lewat katalog sebelum habis.",
};

function line(product: CatalogProduct) {
  const tags = [
    product.kind === "digital" ? "digital" : "",
    product.availability === "preorder" ? `PO${product.leadTime ? ` ${product.leadTime}` : ""}` : "",
  ].filter(Boolean);
  return `• ${product.name} — ${promoPrice(product)}${tags.length ? ` (${tags.join(", ")})` : ""}`;
}

/** Broadcast message for WhatsApp chats and groups. Only orderable products are included. */
export function buildBroadcast({
  store,
  products,
  template,
  headline = "",
  note = "",
  origin,
  links = true,
}: {
  store: Pick<Storefront, "id" | "slug" | "name">;
  products: CatalogProduct[];
  template: PromoTemplate;
  headline?: string;
  note?: string;
  origin: string;
  links?: boolean;
}) {
  const picked = products.filter((p) => p.published && p.availability !== "unavailable").slice(0, MAX_PROMO_PRODUCTS);
  const parts = [intro[template](store.name || "toko kami")];
  if (headline.trim()) parts.push(headline.trim());
  if (picked.length)
    parts.push(
      picked
        .map((p) => (links ? `${line(p)}\n  ${productLink(store, p, origin)}` : line(p)))
        .join("\n"),
    );
  if (note.trim()) parts.push(note.trim());
  parts.push(closing[template]);
  parts.push(`🛍️ Lihat katalog: ${shopLink(store, origin)}`);
  return parts.join("\n\n");
}

/** Short version for WhatsApp status: no per-product links, capped length. */
export function statusText(args: Omit<Parameters<typeof buildBroadcast>[0], "links">) {
  const full = buildBroadcast({ ...args, links: false });
  if (full.length <= STATUS_LIMIT) return full;
  const link = `🛍️ Lihat katalog: ${shopLink(args.store, args.origin)}`;
  const room = STATUS_LIMIT - link.length - 3;
  return `${full.slice(0, room).replace(/\s+\S*$/, "")}…\n\n${link}`;
}

/** One line for the WhatsApp profile "About"/bio (139 characters max on WhatsApp). */
export function bioText(store: Pick<Storefront, "id" | "slug" | "name">, origin: string) {
  const link = shopLink(store, origin).replace(/^https?:\/\//, "");
  const text = `Belanja di ${store.name || "toko kami"}: ${link}`;
  return text.length <= 139 ? text : `Katalog: ${link}`.slice(0, 139);
}
