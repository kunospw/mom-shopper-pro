import { reservedSlugs, slugPattern } from "@/lib/catalog";

/**
 * Turns a shop name into a link suggestion: "Toko Bunda Rina!" → "toko-bunda-rina".
 * Returns "" when the name has too few letters to make a valid link.
 */
export function suggestSlug(name: string) {
  let slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  if ((reservedSlugs as readonly string[]).includes(slug)) slug = `${slug}-toko`;
  return slugPattern.test(slug) ? slug : "";
}

/**
 * Accepts the ways people type Indonesian numbers (0812…, +62 812…, 812…, 62-812…)
 * and returns digits with the country code, the format the shop stores.
 * Numbers from other countries are kept as typed (digits only).
 */
export function toWhatsApp(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.replace(/^0+/, "")}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export const whatsAppPattern = /^[1-9][0-9]{7,14}$/;

/** "6281234567890" → "+62 812-3456-7890" for confirmation text. */
export function formatWhatsApp(number: string) {
  if (!whatsAppPattern.test(number)) return number;
  if (!number.startsWith("62")) return `+${number}`;
  const rest = number.slice(2);
  const parts = [rest.slice(0, 3), rest.slice(3, 7), rest.slice(7)].filter(Boolean);
  return `+62 ${parts.join("-")}`;
}

/** Starting points for "Tentang toko"; the owner edits them after inserting. */
export const descriptionIdeas = [
  { label: "Ready & PO", text: "Jual produk ready stock dan pre-order. Pilih produk, kirim pesanan, lalu kami konfirmasi lewat WhatsApp." },
  { label: "Titip beli", text: "Jasa titip belanja. PO dibuka berkala, pembayaran DP dulu dan pelunasan saat barang tiba." },
  { label: "Makanan rumahan", text: "Masakan dan camilan rumahan, dibuat sesuai pesanan. Pesan H-1 supaya kami siapkan." },
  { label: "Produk digital", text: "Produk digital dikirim lewat WhatsApp setelah pembayaran dikonfirmasi." },
] as const;
