import type { CSSProperties } from "react";
import { BusinessBrand } from "./BusinessBrand";
import { AccentPicker, LogoPicker } from "@/components/StoreFields";
import { useAppearance } from "@/hooks/use-appearance";
import { effectiveAccentKey, getAccent } from "@/lib/branding";
import type { UserProfileForm } from "@/types/user";

type Accent = NonNullable<UserProfileForm["businessAccent"]>;
/** Workspace and invoice identity: logo and main color, with a live preview. */
export function BrandingSettings({ name, logo, accent, onLogoChange, onAccentChange, onBusyChange }: {
  name: string; logo?: string; accent?: Accent;
  onBusyChange: (value: boolean) => void;
  onLogoChange: (value: string) => void; onAccentChange: (value: Accent) => void;
}) {
  const { resolvedMode } = useAppearance();
  const theme = getAccent(accent);
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h3 className="text-base font-semibold">Identitas & warna</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">Logo dan warna ruang usaha serta invoice. Simpan untuk menerapkannya.</p>
      <div className="mt-4 rounded-xl border bg-muted/40 p-4" style={{ "--primary": resolvedMode === "dark" ? theme.darkColor : theme.color } as CSSProperties}>
        <BusinessBrand name={name} logo={logo} />
      </div>
      <div className="mt-5 space-y-5">
        <LogoPicker name={name || "Bisnis"} value={logo ?? ""} onChange={onLogoChange} onBusyChange={onBusyChange} hint="PNG, JPG, atau WebP, maksimal 100 KB. Tampil di ruang usaha dan invoice." />
        <AccentPicker value={effectiveAccentKey(accent)} onChange={(value) => onAccentChange(value as Accent)} legend="Warna utama" />
      </div>
    </section>
  );
}
