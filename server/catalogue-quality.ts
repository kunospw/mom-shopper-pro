import type { Candidate } from "../src/lib/catalogue-ingestion";

/** Explicit Rp/IDR and grouped-thousands values, in source order. */
export function sourcePrices(text: string) {
  const marked = [...text.matchAll(/\b(?:rp|idr)\s*\.?\s*\d+(?:[.,]\d+)*/gi)];
  const grouped = [...text.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b/g)]
    .filter(m => !marked.some(p => m.index! >= p.index! && m.index! + m[0].length <= p.index! + p[0].length));
  return [...marked, ...grouped].sort((a, b) => a.index! - b.index!).map(m => Number(m[0].replace(/\D/g, "")));
}
/** Conservative MVP workload bound: one explicit Rp/IDR price point per candidate. */
export function explicitPricePoints(text: string) {
  return sourcePrices(text).length;
}
/** Source prices no draft accounts for, counting repeats. Shown to the seller; never turned into drafts. */
export function unmatchedPrices(values: Candidate[], text: string) {
  const left = sourcePrices(text);
  for (const value of values) {
    const i = value.price == null ? -1 : left.indexOf(value.price);
    if (i >= 0) left.splice(i, 1);
  }
  return left.filter(n => n > 0).sort((a, b) => a - b);
}
const words = (value: string) => (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
/** A duration/plan label alone does not identify a product. Uncertain facts stay null. */
export function groundCandidates(values: Candidate[], text: string): Candidate[] {
  const evidence = new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? [])
    .filter(n => /^\d+$/.test(n) || /^\d{1,3}(?:[.,]\d{3})+$/.test(n))
    .map(n => Number(n.replace(/[.,]/g, ""))));
  // OCR may join words ("HBOMAX"), so a name word only has to occur inside the compacted text.
  const compact = words(text).join("");
  const labelsOnly = /^(?:\d+\s*(?:hari|hare|bulan|buian|8uian|tahun|minggu|day|days|month|months|year|years)|shar|sharing|private|semi\s*private|premium|standard|standar|basic|famplan|indplan)$/i;
  return values.map(value => {
    // Every word of a name must come from the OCR text, so a brand cannot be guessed from a logo.
    const named = value.name && !labelsOnly.test(value.name.trim()) && words(value.name).every(w => compact.includes(w));
    const name = named ? value.name : null;
    return {
      ...value, name,
      price: name && value.price != null && evidence.has(value.price) ? value.price : null,
      sku: value.sku && text.includes(value.sku) ? value.sku : null,
      imageUrl: value.imageUrl && text.includes(value.imageUrl) ? value.imageUrl : null,
    };
  });
}
