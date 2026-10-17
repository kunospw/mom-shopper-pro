export type AppearanceMode = "system" | "light" | "dark";
export type FontSize = "standard" | "large" | "extra-large";
export interface AppearancePreferences { mode: AppearanceMode; fontSize: FontSize }
export const defaultAppearance: AppearancePreferences = { mode: "system", fontSize: "standard" };
export const fontScales: Record<FontSize, string> = { standard: "100%", large: "112.5%", "extra-large": "125%" };

export function normalizeAppearance(value: unknown): AppearancePreferences {
  const input = value && typeof value === "object" ? value as Partial<AppearancePreferences> : {};
  return {
    mode: ["system", "light", "dark"].includes(input.mode) ? input.mode : "system",
    fontSize: ["standard", "large", "extra-large"].includes(input.fontSize) ? input.fontSize : "standard",
  };
}
export function appearanceKey(uid?: string) { return `ruang-usaha:appearance:${uid || "guest"}`; }
export function readAppearance(key: string): AppearancePreferences {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(key) || "null")); }
  catch { return { ...defaultAppearance }; }
}
