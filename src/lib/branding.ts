export const accents = {
  teal: { label: "Hijau laut", color: "173 80% 26%", darkColor: "173 65% 60%" },
  blue: { label: "Biru", color: "217 76% 40%", darkColor: "217 80% 72%" },
  violet: { label: "Ungu", color: "262 65% 43%", darkColor: "262 80% 78%" },
} as const;

export function getAccent(value?: string) {
  return value && Object.prototype.hasOwnProperty.call(accents, value)
    ? accents[value as keyof typeof accents]
    : accents.teal;
}

// Only bounded raster data URLs; no external image requests or SVG content.
export function isBusinessLogo(value?: string): boolean {
  return !!value && value.length <= 140000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
