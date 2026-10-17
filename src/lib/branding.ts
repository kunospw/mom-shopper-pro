export const PLATFORM_NAME = "LarisKu";
export const PLATFORM_TAGLINE = "Dari rumah, laris ke mana-mana";

/**
 * Brand accents. teal, blue and violet keep their original values exactly so
 * nothing already chosen (or implied) changes color; `forest` is new.
 * `soft` and `ink` (tinted background and dark text) come from the design and
 * are only used by newer components.
 */
export const accents = {
  forest: { label: "Hutan", color: "150 33% 27%", darkColor: "144 25% 60%", soft: "107 23% 92%", ink: "152 33% 20%" },
  teal: { label: "Hijau laut", color: "173 80% 26%", darkColor: "173 65% 60%", soft: "170 41% 91%", ink: "175 78% 20%" },
  blue: { label: "Biru", color: "217 76% 40%", darkColor: "217 80% 72%", soft: "213 59% 93%", ink: "212 64% 32%" },
  violet: { label: "Ungu", color: "262 65% 43%", darkColor: "262 80% 78%", soft: "264 48% 94%", ink: "262 40% 38%" },
} as const;
export type AccentKey = keyof typeof accents;

/** What a profile or shop with no stored accent has always rendered as. Never change this. */
export const LEGACY_ACCENT: AccentKey = "teal";
/** The accent written into brand-new accounts. Existing records are never migrated to it. */
export const NEW_ACCOUNT_ACCENT: AccentKey = "forest";

export function effectiveAccentKey(value?: string): AccentKey {
  return value && Object.prototype.hasOwnProperty.call(accents, value)
    ? (value as AccentKey)
    : LEGACY_ACCENT;
}
export function getAccent(value?: string) {
  return accents[effectiveAccentKey(value)];
}

// Only bounded raster data URLs; no external image requests or SVG content.
export function isBusinessLogo(value?: string): boolean {
  return !!value && value.length <= 140000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
