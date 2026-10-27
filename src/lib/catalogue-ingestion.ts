import { z } from "zod";
import { emptyProduct, productSchema } from "./catalog";

export const LIMITS = { bytes: 2 * 1024 * 1024, pages: 1, products: 15, text: 18000, pixels: 16000000, processingMs: 35000 } as const;
const optionalText = (max: number) => z.string().trim().max(max).nullable();
// Every field is present; unknown/missing information is represented by null.
export const candidateSchema = z.object({
  name: optionalText(80), sku: optionalText(80),
  price: z.number().int().min(1).max(1000000000).nullable(),
  description: optionalText(1500),
  imageUrl: z.string().url().max(2000).refine(v => v.startsWith("https://")).nullable(),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const extractionSchema = z.object({
  complete: z.literal(true), products: z.array(candidateSchema).min(1).max(LIMITS.products),
}).strict();
export const reviewSchema = z.array(z.object({ id: z.string().regex(/^\d{2}$/), candidate: candidateSchema }).strict())
  .min(1).max(LIMITS.products).refine(v => new Set(v.map(x => x.id)).size === v.length);
export function missing(candidate: Candidate) {
  return [!candidate.name && "Nama wajib diisi", candidate.price == null && "Harga wajib diisi"].filter(Boolean) as string[];
}
export function finalProduct(value: unknown) {
  const c = candidateSchema.parse(value);
  if (missing(c).length) throw new Error("missing-required-fields");
  // SKU has no equivalent in the current product schema. Remote URLs are never fetched.
  // Absence of optional product text maps to the existing empty value at confirmation only.
  return productSchema.parse({ ...emptyProduct, name: c.name, price: c.price, description: c.description ?? "", published: false });
}
export type Draft = { id: string; candidate: Candidate };
export type JobView = { id: string; status: "processing" | "failed" | "review" | "confirmed"; pipeline?: string; error?: string; drafts: Draft[]; elapsedMs?: number; productIds?: string[] };
