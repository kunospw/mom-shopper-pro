import type { Storefront } from "./catalog";

/** Public shop address: the readable slug when set, otherwise the owner ID. */
export function shopPath(store: Pick<Storefront, "slug"> | null, uid?: string) {
  const key = store?.slug || uid || "";
  return `/shop/${encodeURIComponent(key)}`;
}
export function shopUrl(store: Pick<Storefront, "slug"> | null, uid?: string) {
  return `${window.location.origin}${shopPath(store, uid)}`;
}
