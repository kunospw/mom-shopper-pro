import { LIMITS, type Candidate } from "../src/lib/catalogue-ingestion";

const link = /https:\/\/s\.shopee\.co\.id\/([A-Za-z0-9]{6,16})(?![A-Za-z0-9/])/g;
const rupiah = String.raw`Rp\s?(\d{1,3}(?:\.\d{3})+|\d{1,10})`;
// Shopee's Indonesian share text. Other wording leaves name/price empty rather than guessing.
const share = new RegExp(String.raw`\bCek\s+(.+?)\s+dengan harga\s+${rupiah}(?:\s*-\s*${rupiah})?\s*\.?\s*Dapatkan di Shopee`, "is");
const amount = (value?: string) => {
  const n = value ? Number(value.replace(/\./g, "")) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 1_000_000_000 ? n : null;
};

/** Reads the seller's pasted share text. Exactly one Shopee short link is required. */
export function parseShopeeShare(text: string) {
  const codes = new Set([...text.matchAll(link)].map(m => m[1]));
  if (codes.size !== 1) return null;
  const match = text.match(share);
  const title = match ? match[1].replace(/\s+/g, " ").trim().slice(0, 300) || null : null;
  const low = amount(match?.[2]), high = amount(match?.[3]);
  return { code: [...codes][0], title, listedPrice: low, listedMax: high && low && high > low ? high : null };
}

/** The draft never copies the Shopee price: a reseller sets her own selling price. */
/** Shopee titles are often keyword lists; a long one is cut at the last whole word for the seller to check. */
export function shortName(title: string) {
  if (title.length <= LIMITS.nameMax) return title;
  const cut = title.slice(0, LIMITS.nameMax + 1);
  const end = cut.lastIndexOf(" ");
  return (end > 0 ? cut.slice(0, end) : title.slice(0, LIMITS.nameMax)).replace(/[\s,;:|/-]+$/, "");
}
export function shopeeCandidate(title: string | null): Candidate {
  return { name: title ? shortName(title) : null, sku: null, price: null, description: null, imageUrl: null };
}

/**
 * Reads only the short link's first redirect, with an honest user agent, to learn the shop/item IDs.
 * The Shopee page itself is never requested. The URL is built from a validated code, never from user input.
 */
export async function resolveShopeeLink(code: string, signal: AbortSignal) {
  if (!/^[A-Za-z0-9]{6,16}$/.test(code)) return null;
  const response = await fetch(`https://s.shopee.co.id/${code}`, {
    redirect: "manual", headers: { "User-Agent": "LarisKu-LinkPreview/1.0 (+https://larisku.dyahrini.tech)" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  await response.body?.cancel();
  if (response.status < 300 || response.status >= 400) return null;
  const target = response.headers.get("location")?.match(/^https:\/\/shopee\.co\.id\/opaanlp\/(\d{1,20})\/(\d{1,20})(?:[?#]|$)/);
  return target ? { shopId: target[1], itemId: target[2] } : null;
}
