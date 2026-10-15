import { z } from "zod";

const raster = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const storeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
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
    accent: z.enum(["teal", "blue", "violet"]),
    logo: image(140000),
    published: z.boolean(),
  })
  .strict()
  .refine(
    (value) => !value.published || (!!value.name && !!value.whatsapp),
    "Isi nama toko dan nomor WhatsApp sebelum membuka katalog.",
  );
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
      .array(z.string().trim().min(1).max(50))
      .max(8)
      .refine(
        (values) => new Set(values).size === values.length,
        "Pilihan tidak boleh berulang.",
      ),
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
  published: false,
};
export function normalizeWhatsApp(value: string) {
  return value.replace(/[\s()+-]/g, "");
}
export function readStorefront(
  id: string,
  value: Record<string, unknown>,
): Storefront {
  const { name, description, whatsapp, accent, logo, published } = value;
  return {
    id,
    ...storefrontSchema.parse({
      name,
      description,
      whatsapp,
      accent,
      logo,
      published,
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
      options,
      published,
    }),
  };
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
      product.options.length ? !product.options.includes(option) : option !== ""
    )
      continue;
    const existing = result.find(
      (item) => item.productId === productId && item.option === option,
    );
    if (existing)
      existing.quantity = Math.min(99, existing.quantity + quantity);
    else if (result.length < 10) result.push({ productId, option, quantity });
  }
  return result;
}
export function cartTotal(lines: CartLine[], products: CatalogProduct[]) {
  return reconcileCart(lines, products).reduce(
    (sum, line) =>
      sum +
      products.find((product) => product.id === line.productId).price *
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
          product.availability,
          product.leadTime,
          product.optionLabel,
          product.options,
        ];
      })(),
    ]),
  ]);
}
export function whatsAppOrder(
  store: Storefront,
  products: CatalogProduct[],
  lines: CartLine[],
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
  const rupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  const items = cart.map((line, index) => {
    const product = products.find((item) => item.id === line.productId);
    return `${index + 1}. ${product.name}${line.option ? ` — ${product.optionLabel}: ${line.option}` : ""}\n   ${line.quantity} pcs × ${rupiah(product.price)}\n   ${availabilityLabels[product.availability]}${product.availability === "preorder" ? ` · ${product.leadTime}` : ""}\n   Kode produk: ${product.id}`;
  });
  const message = `Halo ${validStore.name}, saya ingin mengajukan pesanan:\n\n${items.join("\n\n")}\n\nSubtotal produk: ${rupiah(cartTotal(cart, products))} (belum termasuk ongkir).\nMohon konfirmasi stok, harga akhir, waktu kirim, dan cara pembayaran. Ini permintaan pesanan, belum pembayaran.`;
  return `https://wa.me/${validStore.whatsapp}?text=${encodeURIComponent(message)}`;
}
