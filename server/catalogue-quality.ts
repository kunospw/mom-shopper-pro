import type { Candidate } from "../src/lib/catalogue-ingestion";

/** Conservative MVP workload bound: one explicit Rp/IDR price point per candidate. */
export function explicitPricePoints(text: string) {
  const marked = [...text.matchAll(/\b(?:rp|idr)\s*\.?\s*\d+(?:[.,]\d+)*/gi)];
  const grouped = [...text.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b/g)]
    .filter(m => !marked.some(p => m.index! >= p.index! && m.index! + m[0].length <= p.index! + p[0].length));
  return marked.length + grouped.length;
}
/** A duration/plan label alone does not identify a product. Uncertain facts stay null. */
export function groundCandidates(values: Candidate[], text: string): Candidate[] {
  const evidence = new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? [])
    .filter(n => /^\d+$/.test(n) || /^\d{1,3}(?:[.,]\d{3})+$/.test(n))
    .map(n => Number(n.replace(/[.,]/g, ""))));
  const labelsOnly = /^(?:\d+\s*(?:hari|hare|bulan|buian|8uian|tahun|minggu|day|days|month|months|year|years)|shar|sharing|private|semi\s*private|premium|standard|standar|basic|famplan|indplan)$/i;
  return values.map(value => {
    const name = value.name && !labelsOnly.test(value.name.trim()) ? value.name : null;
    return {
      ...value, name,
      price: name && value.price != null && evidence.has(value.price) ? value.price : null,
      sku: value.sku && text.includes(value.sku) ? value.sku : null,
      imageUrl: value.imageUrl && text.includes(value.imageUrl) ? value.imageUrl : null,
    };
  });
}
