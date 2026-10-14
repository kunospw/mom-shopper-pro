import { useRef, useState, type CSSProperties } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BusinessBrand } from "./BusinessBrand";
import { useAppearance } from "@/hooks/use-appearance";
import { accents, getAccent, isBusinessLogo } from "@/lib/branding";
import type { UserProfileForm } from "@/types/user";

type Accent = NonNullable<UserProfileForm["businessAccent"]>;
export function BrandingSettings({ name, logo, accent, onLogoChange, onAccentChange, onBusyChange }: {
  name: string; logo?: string; accent?: Accent;
  onBusyChange: (value: boolean) => void;
  onLogoChange: (value: string) => void; onAccentChange: (value: Accent) => void;
}) {
  const { resolvedMode } = useAppearance();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 100 * 1024) {
      setError("Pilih PNG, JPG, atau WebP maksimal 100 KB."); return;
    }
    setReading(true); onBusyChange(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      if (!isBusinessLogo(result)) throw new Error("Invalid logo");
      await new Promise<void>((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(); image.onerror = reject; image.src = result;
      });
      onLogoChange(result);
    } catch { setError("Gambar tidak dapat dibaca. Pilih file lain."); }
    finally { setReading(false); onBusyChange(false); }
  }
  return <Card>
    <CardHeader><CardTitle className="text-lg">Identitas & tampilan</CardTitle><CardDescription>Sesuaikan ruang kerja dengan bisnis Anda. Simpan pengaturan untuk menerapkannya.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-xl border bg-muted/40 p-4" style={{ "--primary": resolvedMode === "dark" ? getAccent(accent).darkColor : getAccent(accent).color } as CSSProperties}><BusinessBrand name={name} logo={logo} /></div>
      <div className="space-y-2"><Label htmlFor="business-logo">Logo bisnis</Label>
        <Input ref={input} id="business-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={reading} className="h-auto min-h-11 file:mr-3 file:py-1" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="text-xs text-muted-foreground">PNG, JPG, atau WebP, maksimal 100 KB. Logo tampil di ruang kerja dan invoice.</p>
        {reading && <p role="status" className="text-sm">Membaca gambar…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {logo && <Button type="button" variant="outline" disabled={reading} onClick={() => onLogoChange("")}>Hapus logo</Button>}
      </div>
      <fieldset><legend className="mb-3 text-sm font-medium">Warna utama</legend>
        <RadioGroup value={accent || "teal"} onValueChange={value => onAccentChange(value as Accent)} className="flex flex-wrap gap-3" aria-label="Warna utama">
          {Object.entries(accents).map(([key, choice]) => <Label key={key} htmlFor={`accent-${key}`} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem id={`accent-${key}`} value={key} />
            <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ backgroundColor: `hsl(${choice.color})` }} />{choice.label}
          </Label>)}
        </RadioGroup>
      </fieldset>
    </CardContent>
  </Card>;
}
