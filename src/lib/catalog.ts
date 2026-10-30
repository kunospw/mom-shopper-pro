import { z } from "zod";

export const raster = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
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
/** How a buyer receives physical goods; the seller chooses which to offer. */
export const deliveryOptions = ["deliver", "pickup"] as const;
export const deliveryLabels = { deliver: "Antar ke alamat", pickup: "Ambil di tempat" } as const;
/** How a buyer intends to pay; the seller chooses which to offer. */
export const paymentOptions = ["transfer", "cod", "qris", "ewallet"] as const;
export const buyerPaymentLabels = { transfer: "Transfer bank", cod: "Bayar di tempat (COD)", qris: "QRIS", ewallet: "E-wallet" } as const;
export type Delivery = (typeof deliveryOptions)[number];
export type BuyerPayment = (typeof paymentOptions)[number];
const choices = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).max(values.length).refine((list) => new Set(list).size === list.length, "Pilihan tidak boleh berulang.");
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
    // Shop assistant (buyer Q&A, docs/shop-assistant.md); absent on older shops = off.
    assistant: z.boolean().optional(),
    // Asked at checkout when not empty; absent on older shops = arranged in chat.
    delivery: choices(deliveryOptions).optional(),
    payments: choices(paymentOptions).optional(),
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
  const { name, description, whatsapp, accent, logo, published, slug, assistant, delivery, payments } = value;
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
      assistant: assistant === true,
      ...(delivery !== undefined && { delivery }),
      ...(payments !== undefined && { payments }),
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
        products.find((product) => product.id === line.productId)!,
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
    store.delivery ?? [],
    store.payments ?? [],
    reconcileCart(lines, products).map((line) => [
      line,
      (() => {
        const product = products.find(
          (product) => product.id === line.productId,
        )!;
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
/** Buyer's WhatsApp number in international form (62…), so the seller can confirm the order. */
export const buyerPhoneSchema = z.string().regex(/^62[1-9][0-9]{7,12}$/, "Isi nomor WhatsApp yang valid, contoh 081234567890.");
/** Accepts 0812…, 812…, +62 812-… or 62812… and returns 62812…; other input is returned as digits only. */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
/** Seller-only record beside each order (orders/{id}/contact/buyer): phone plus checkout choices. */
export const buyerContactSchema = z
  .object({
    phone: buyerPhoneSchema,
    delivery: z.enum(deliveryOptions).optional(),
    address: z.string().trim().min(10, "Isi alamat lengkap untuk pengantaran.").max(300).optional(),
    payment: z.enum(paymentOptions).optional(),
  })
  .strict()
  .refine((value) => (value.delivery === "deliver") === (value.address !== undefined), "Isi alamat lengkap untuk pengantaran.");
export type BuyerContact = z.infer<typeof buyerContactSchema>;
export const orderRequestSchema = z
  .object({
    buyerName: z.string().trim().min(1, "Isi nama Anda.").max(60),
    note: z.string().trim().max(300),
    items: z.array(orderItemSchema).min(1).max(MAX_ORDER_LINES),
  })
  .strict();
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderProgress = z.infer<typeof orderProgressSchema>;
/** Shop details frozen into each order so tracking outlives unpublish and expiry. */
export interface OrderShop {
  name: string;
  whatsapp: string;
  slug: string;
}
export interface Order extends z.infer<typeof orderRequestSchema> {
  id: string;
  /** Seller-only contact record (orders/{id}/contact/buyer); loaded for pending orders. */
  buyerPhone?: string;
  buyerDelivery?: Delivery;
  buyerAddress?: string;
  buyerPayment?: BuyerPayment;
  status: z.infer<typeof orderStatusSchema>;
  progress: OrderProgress;
  /** Null for orders created before the snapshot existed. */
  shop: OrderShop | null;
  /** When each progress stage was reached (ISO); empty for older orders. */
  steps: Partial<Record<OrderProgress, string>>;
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
export function orderShopSnapshot(store: Pick<Storefront, "name" | "whatsapp" | "slug">): OrderShop {
  return { name: store.name, whatsapp: store.whatsapp, slug: store.slug };
}
function readShop(value: unknown): OrderShop | null {
  if (!value || typeof value !== "object") return null;
  const { name, whatsapp, slug } = value as Record<string, unknown>;
  return typeof name === "string" && typeof whatsapp === "string" && typeof slug === "string"
    ? { name, whatsapp, slug }
    : null;
}
function readSteps(value: unknown): Order["steps"] {
  const steps: Order["steps"] = {};
  if (!value || typeof value !== "object") return steps;
  for (const key of orderProgressSchema.options) {
    const stamp = (value as Record<string, { toDate?: () => Date } | undefined>)[key];
    if (stamp?.toDate) steps[key] = stamp.toDate().toISOString();
  }
  return steps;
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
    shop: readShop(value.shop),
    steps: readSteps(value.steps),
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
    const product = products.find((item) => item.id === line.productId)!;
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

/** Short Rupiah for option tiles: 179000 -> "179rb", 1250000 -> "1,25jt". */
export function shortRupiah(value: number) {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("id-ID")}rb`;
  return String(value);
}

/**
 * The WhatsApp message for a saved order, built from what was actually stored
 * (frozen names, options and prices), so the chat always matches the record.
 */
export function orderMessage(
  order: Pick<Order, "id" | "buyerName" | "items" | "subtotal" | "note" | "buyerDelivery" | "buyerAddress" | "buyerPayment"> & { shop: OrderShop | null },
  statusUrl: string,
) {
  const shop = order.shop?.name || "Kak";
  const lines = order.items.map(
    (item) =>
      `• ${item.quantity}× ${item.name}${item.option ? ` (${item.option})` : ""} ${rupiah(item.unitPrice * item.quantity)}`,
  );
  return [
    `Halo ${shop}, saya ${order.buyerName} ingin memesan (Pesanan #${orderCode(order.id)}):`,
    ...lines,
    `Subtotal ${rupiah(order.subtotal)} (belum ongkir)`,
    ...(order.note ? [`Catatan: ${order.note}`] : []),
    ...(order.buyerDelivery ? [`Pengiriman: ${deliveryLabels[order.buyerDelivery]}`] : []),
    ...(order.buyerAddress ? [`Alamat: ${order.buyerAddress}`] : []),
    ...(order.buyerPayment ? [`Pembayaran: ${buyerPaymentLabels[order.buyerPayment]}`] : []),
    order.buyerDelivery && order.buyerPayment ? "Mohon konfirmasi stok dan total akhir." : "Mohon konfirmasi stok, ongkir, dan cara pembayaran.",
    statusUrl,
  ].join("\n");
}
export function whatsAppLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
