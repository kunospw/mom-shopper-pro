import type { PlanState } from "./entitlement";

/** Monthly plan price in whole Rupiah. Override with VITE_PLAN_PRICE_IDR; 0 or invalid hides the price. */
export function parsePrice(value: string | undefined, fallback = 49000) {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value.replace(/[^\d]/g, ""));
  return Number.isInteger(n) && n > 0 ? n : 0;
}
/** WhatsApp number (country code, digits only) the upgrade button contacts; null hides the button. */
export function parseWhatsApp(value: string | undefined, fallback = "6281298590798") {
  const raw = (value === undefined || value.trim() === "" ? fallback : value).replace(/[\s()+-]/g, "");
  return /^[1-9][0-9]{7,14}$/.test(raw) ? raw : null;
}

const env = (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string | undefined> }).env) || {};
export const PLAN_PRICE_IDR = parsePrice(env.VITE_PLAN_PRICE_IDR);
export const UPGRADE_WHATSAPP = parseWhatsApp(env.VITE_UPGRADE_WHATSAPP);

/** Short, readable code the operator uses to find `entitlements/{uid}`. */
export const accountCode = (uid: string) => uid.slice(0, 8);

const day = (d: Date | null) =>
  d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

export function planLine(plan: PlanState) {
  switch (plan.phase) {
    case "trial":
      return `Uji coba berakhir ${day(plan.endsAt)}`;
    case "paid":
      return `Paket aktif sampai ${day(plan.endsAt)}`;
    case "grace":
      return `Toko lama, terbuka sampai ${day(plan.endsAt)}`;
    case "expired":
      return plan.endsAt ? `Masa aktif berakhir ${day(plan.endsAt)}` : "Masa aktif berakhir";
    default:
      return "Belum memulai uji coba";
  }
}

/** Prefilled WhatsApp text for the upgrade request. */
export function upgradeMessage({
  shopName,
  email,
  uid,
  plan,
  price = PLAN_PRICE_IDR,
}: {
  shopName: string;
  email: string;
  uid: string;
  plan: PlanState;
  price?: number;
}) {
  return [
    `Halo, saya ingin berlangganan Mom Shopper Pro${price ? ` (Rp ${price.toLocaleString("id-ID")}/bulan)` : ""}.`,
    `Toko: ${shopName || "-"}`,
    `Email akun: ${email || "-"}`,
    `Kode akun: ${accountCode(uid)}`,
    `Status: ${planLine(plan)}`,
    "Mohon info cara pembayarannya. Terima kasih.",
  ].join("\n");
}
export function upgradeLink(text: string, phone = UPGRADE_WHATSAPP) {
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}
