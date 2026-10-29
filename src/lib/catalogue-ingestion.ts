import { z } from "zod";
import { emptyProduct, productSchema, raster } from "./catalog";

export const LIMITS = { bytes: 2 * 1024 * 1024, pages: 1, products: 15, text: 18000, pixels: 16000000, processingMs: 35000, nameMax: 80 } as const;
const optionalText = (max: number) => z.string().trim().max(max).nullable();
// Every field is present; unknown/missing information is represented by null.
export const candidateSchema = z.object({
  name: optionalText(LIMITS.nameMax), sku: optionalText(80),
  price: z.number().int().min(1).max(1000000000).nullable(),
  description: optionalText(1500),
  imageUrl: z.string().url().max(2000).refine(v => v.startsWith("https://")).nullable(),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const extractionSchema = z.object({
  complete: z.literal(true), products: z.array(candidateSchema).min(1).max(LIMITS.products),
}).strict();
// The seller's own product photo, already squared and compressed in the browser (same limit as the Catalog editor).
export const photoSchema = z.string().max(180000).regex(raster).nullable();
export const reviewSchema = z.array(z.object({ id: z.string().regex(/^\d{2}$/), candidate: candidateSchema, photo: photoSchema.optional() }).strict())
  .min(1).max(LIMITS.products).refine(v => new Set(v.map(x => x.id)).size === v.length);
export function missing(candidate: Candidate, photo?: string | null, photoRequired = false) {
  return [!candidate.name && "Nama wajib diisi", candidate.price == null && "Harga wajib diisi", photoRequired && !photo && "Foto wajib diisi"].filter(Boolean) as string[];
}
export function finalProduct(value: unknown, photo: string | null = null) {
  const c = candidateSchema.parse(value);
  if (missing(c).length) throw new Error("missing-required-fields");
  // SKU has no equivalent in the current product schema. Remote URLs are never fetched.
  // Absence of optional product text maps to the existing empty value at confirmation only.
  return productSchema.parse({ ...emptyProduct, name: c.name, price: c.price, description: c.description ?? "", image: photoSchema.parse(photo) ?? "", published: false });
}
export type Draft = { id: string; candidate: Candidate; photo?: string | null };
// Text copied from Shopee's Share button: "Cek <nama> dengan harga Rp<harga>. Dapatkan di Shopee sekarang! <link>".
export const SHOPEE_TEXT_MAX = 1000;
export const shopeeSourceSchema = z.object({
  kind: z.literal("shopee"), code: z.string().regex(/^[A-Za-z0-9]{6,16}$/), title: z.string().max(300).nullable(),
  listedPrice: z.number().int().positive().nullable(), listedMax: z.number().int().positive().nullable(),
  shopId: z.string().regex(/^\d{1,20}$/).nullable(), itemId: z.string().regex(/^\d{1,20}$/).nullable(),
}).strict();
export type ShopeeSource = z.infer<typeof shopeeSourceSchema>;
/** Pipelines whose drafts came from samples or superseded extraction; the private real preview ignores them. */
export const retiredPipelines = ["legacy", "vision-ollama-v1", "tesseract-ollama-v1"];
export type JobView = { id: string; status: "processing" | "failed" | "review" | "confirmed"; pipeline?: string; error?: string; drafts: Draft[]; elapsedMs?: number; productIds?: string[]; unmatchedPrices?: number[]; source?: ShopeeSource };
