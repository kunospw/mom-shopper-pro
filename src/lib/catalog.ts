import { z } from "zod";

const raster = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const storeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const reservedSlugs = [
  "admin", "api", "app", "catalog", "customers", "costs", "login", "logout",
  "orders", "reports", "sales", "settings", "shop", "signup", "static", "www",
] as const;
/** Firestore rules can only evaluate this many validated lines per order. */
export const MAX_ORDER_LINES = 6;
export const slugPattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const slugSchema = z
  .string()
  .regex(slugPattern, "Gunakan 3-30 huruf kecil, angka, atau tanda hubung.")
  .refine((value) => !(reservedSlugs as readonly string[]).includes(value), {
    message: "Nama tautan ini dicadangkan. Pilih nama lain.",
  });
const image = (limit: number) =>
  z
    .string()
    .max(limit)
    .refine(
      (value) => value === "" || raster.test(value),
      "Gunakan foto PNG, JPG, atau WebP yang valid.",
    );
export const storefrontSchema = z
  .object({
    name: z.string().trim().max(80),
    description: z.string().trim().max(600),
    whatsapp: z
      .string()
      .regex(
        /^$|^[1-9][0-9]{7,14}$/,
        "Gunakan kode negara, contoh 6281234567890.",
      ),
    accent: z.enum(["forest", "teal", "blue", "violet"]),
    logo: image(140000),
    published: z.boolean(),
    slug: z.union([z.literal(""), slugSchema]),
  })
  .strict()
  .refine(
    (value) => !value.published || (!!value.name && !!value.whatsapp),
    "Isi nama toko dan nomor WhatsApp sebelum membuka katalog.",
  );
export const optionSchema = z
  .object({
    label: z.string().trim().min(1).max(50),
    // 0 means "use the product's base price".
    price: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();
export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Nama produk wajib diisi.").max(80),
    description: z.string().trim().max(1500),
    category: z.string().trim().max(40),
    price: z
      .number()
      .int("Harga harus berupa Rupiah bulat.")
      .min(1, "Isi harga yang lebih dari nol.")
      .max(1_000_000_000),
    image: image(180000),
    availability: z.enum(["ready", "preorder", "unavailable"]),
    leadTime: z.string().trim().max(100),
    optionLabel: z.string().trim().min(1).max(30),
    options: z
      .array(optionSchema)
      .max(8)
      .refine(
        (values) => new Set(values.map((o) => o.label)).size === values.length,
        "Pilihan tidak boleh berulang.",
      ),
    kind: z.enum(["physical", "digital"]),
    published: z.boolean(),
  })
  .strict()
  .refine(
    (value) => value.availability !== "preorder" || !!value.leadTime,
    "Isi estimasi waktu untuk produk preorder.",
  );
export type StorefrontFields = z.infer<typeof storefrontSchema>;
export type Storefront = StorefrontFields & { id: string };
export type CatalogProductFields = z.infer<typeof productSchema>;
export type CatalogProduct = CatalogProductFields & { id: string };
export type ProductOption = z.infer<typeof optionSchema>;
export interface CartLine {
  productId: string;
  option: string;
  quantity: number;
}
export const availabilityLabels = {
  ready: "Ready stock",
  preorder: "Preorder",
  unavailable: "Belum tersedia",
} as const;
export const emptyProduct: CatalogProductFields = {
  name: "",
  description: "",
  category: "",
  price: 0,
  image: "",
  availability: "ready",
  leadTime: "",
  optionLabel: "Pilihan",
  options: [],
  kind: "physical",
  published: false,
};
export function normalizeWhatsApp(value: string) {
  return value.replace(/[\s()+-]/g, "");
}
export function readStorefront(
  id: string,
  value: Record<string, unknown>,
): Storefront {
  const { name, description, whatsapp, accent, logo, published, slug } = value;
  return {
    id,
    ...storefrontSchema.parse({
      name,
      description,
      whatsapp,
      accent,
      logo,
      published,
      slug: slug ?? "",
    }),
  };
}
export function readProduct(
  id: string,
  value: Record<string, unknown>,
): CatalogProduct {
  const {
    name,
    description,
    category,
    price,
    image,
    availability,
    leadTime,
    optionLabel,
    options,
    kind,
    published,
  } = value;
  return {
    id,
    ...productSchema.parse({
      name,
      description,
      category,
      price,
      image,
      availability,
      leadTime,
      optionLabel,
      // Legacy listings stored options as plain strings.
      options: Array.isArray(options)
        ? options.map((option) =>
            typeof option === "string" ? { label: option, price: 0 } : option,
          )
        : options,
      kind: kind ?? "physical",
      published,
    }),
  };
}
export function optionPrice(product: CatalogProduct, option: string) {
  const found = product.options.find((item) => item.label === option);
  return found && found.price > 0 ? found.price : product.price;
}
export function reconcileCart(
  value: unknown,
  products: CatalogProduct[],
): CartLine[] {
  if (!Array.isArray(value)) return [];
  const result: CartLine[] = [];
  for (const candidate of value.slice(0, 100)) {
    if (!candidate || typeof candidate !== "object") continue;
    const { productId, option, quantity } = candidate;
    const product = products.find(
      (item) =>
        item.id === productId &&
        item.published &&
        item.availability !== "unavailable",
    );
    if (
      !product ||
      typeof option !== "string" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    )
      continue;
    if (
      product.options.length
        ? !product.options.some((item) => item.label === option)
        : option !== ""
    )
      continue;
    const existing = result.find(
      (item) => item.productId === productId && item.option === option,
    );
    if (existing)
      existing.quantity = Math.min(99, existing.quantity + quantity);
    else if (result.length < MAX_ORDER_LINES) result.push({ productId, option, quantity });
  }
  return result;
}
export function cartTotal(lines: CartLine[], products: CatalogProduct[]) {
  return reconcileCart(lines, products).reduce(
    (sum, line) =>
      sum +
      optionPrice(
        products.find((product) => product.id === line.productId),
        line.option,
      ) *
        line.quantity,
    0,
  );
}
export function orderSignature(
  store: Storefront,
  products: CatalogProduct[],
  lines: CartLine[],
) {
  return JSON.stringify([
    store.published,
    store.name,
    store.whatsapp,
    reconcileCart(lines, products).map((line) => [
      line,
      (() => {
        const product = products.find(
          (product) => product.id === line.productId,
        );
        return [
          product.id,
          product.name,
          product.price,
          optionPrice(product, line.option),
          product.availability,
          product.leadTime,
          product.optionLabel,
          product.options,
        ];
      })(),
    ]),
  ]);
}
export function orderCode(id: string) {
  return id.slice(0, 6).toUpperCase();
}
export const orderStatusSchema = z.enum(["pending", "confirmed", "rejected"]);
export const orderProgressSchema = z.enum([
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "done",
  "cancelled",
]);
export const orderItemSchema = z
  .object({
    productId: storeIdSchema,
    name: z.string().trim().min(1).max(80),
    option: z.string().max(50),
    kind: z.enum(["physical", "digital"]),
    unitPrice: z.number().int().min(1).max(1_000_000_000),
    quantity: z.number().int().min(1).max(99),
    availability: z.enum(["ready", "preorder", "unavailable"]),
    leadTime: z.string().max(100),
  })
  .strict();
export const orderRequestSchema = z
  .object({
    buyerName: z.string().trim().min(1, "Isi nama Anda.").max(60),
    note: z.string().trim().max(300),
    items: z.array(orderItemSchema).min(1).max(MAX_ORDER_LINES),
  })
  .strict();
export type OrderItem = z.infer<typeof orderItemSchema>;
export interface Order extends z.infer<typeof orderRequestSchema> {
  id: string;
  status: z.infer<typeof orderStatusSchema>;
  progress: z.infer<typeof orderProgressSchema>;
  trackingNo: string;
  sellerNote: string;
  subtotal: number;
  createdAt: string;
}
/** Freeze what the buyer saw (name, option, price) so later edits cannot change it. */
export function orderItems(
  products: CatalogProduct[],
  lines: CartLine[],
): OrderItem[] {
  return reconcileCart(lines, products).map((line) => {
    const product = products.find((item) => item.id === line.productId)!;
    return {
      productId: product.id,
      name: product.name,
      option: line.option,
      kind: product.kind,
      unitPrice: optionPrice(product, line.option),
      quantity: line.quantity,
      availability: product.availability,
      leadTime: product.availability === "preorder" ? product.leadTime : "",
    };
  });
}
export function readOrder(id: string, value: Record<string, unknown>): Order {
  const request = orderRequestSchema.parse({
    buyerName: value.buyerName,
    note: value.note,
    items: value.items,
  });
  const created = value.createdAt as { toDate?: () => Date } | undefined;
  return {
    id,
    ...request,
    status: orderStatusSchema.parse(value.status),
    progress: orderProgressSchema.parse(value.progress),
    trackingNo: typeof value.trackingNo === "string" ? value.trackingNo : "",
    sellerNote: typeof value.sellerNote === "string" ? value.sellerNote : "",
    subtotal: Number(value.subtotal) || 0,
    createdAt: created?.toDate ? created.toDate().toISOString() : "",
  };
}
export function orderSubtotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
export function whatsAppOrder(
  store: Storefront,
  products: CatalogProduct[],
  lines: CartLine[],
  order?: { id: string; buyerName: string; statusUrl: string },
) {
  const { id: _id, ...fields } = store;
  const validStore = storefrontSchema.parse(fields);
  const cart = reconcileCart(lines, products);
  if (
    !validStore.published ||
    !validStore.whatsapp ||
    !cart.length ||
    cart.length !== lines.length
  )
    throw new Error("Pesanan belum siap.");
  const items = cart.map((line, index) => {
    const product = products.find((item) => item.id === line.productId);
    return `${index + 1}. ${product.name}${line.option ? ` — ${product.optionLabel}: ${line.option}` : ""}\n   ${line.quantity} × ${rupiah(optionPrice(product, line.option))}\n   ${product.kind === "digital" ? "Produk digital" : availabilityLabels[product.availability]}${product.availability === "preorder" ? ` · ${product.leadTime}` : ""}`;
  });
  const header = order
    ? `Halo ${validStore.name}, saya ${order.buyerName} ingin memesan (Pesanan #${orderCode(order.id)}):`
    : `Halo ${validStore.name}, saya ingin mengajukan pesanan:`;
  const footer = order
    ? `\n\nCek status pesanan: ${order.statusUrl}`
    : "";
  const message = `${header}\n\n${items.join("\n\n")}\n\nSubtotal produk: ${rupiah(cartTotal(cart, products))} (belum termasuk ongkir).\nMohon konfirmasi stok, harga akhir, waktu kirim, dan cara pembayaran. Ini permintaan pesanan, belum pembayaran.${footer}`;
  return `https://wa.me/${validStore.whatsapp}?text=${encodeURIComponent(message)}`;
}
