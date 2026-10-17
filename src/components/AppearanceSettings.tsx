import { Monitor, Moon, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/hooks/use-appearance";
import { defaultAppearance, type AppearanceMode, type FontSize } from "@/lib/appearance";

export function AppearanceSettings() {
  const { preferences, saved, update } = useAppearance();
  return <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
    <h3 className="text-base font-semibold">Kenyamanan membaca</h3>
    <p className="mt-0.5 text-sm text-muted-foreground">Perubahan langsung diterapkan dan disimpan untuk akun Anda di perangkat ini.</p>
    <div className="mt-5 space-y-6">
      <fieldset className="min-w-0"><legend className="mb-3 text-sm font-medium">Mode tampilan</legend>
        <RadioGroup value={preferences.mode} onValueChange={mode => update({ mode: mode as AppearanceMode })} aria-label="Mode tampilan" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[{ value: "light", label: "Terang", icon: Sun }, { value: "dark", label: "Gelap", icon: Moon }, { value: "system", label: "Ikuti perangkat", icon: Monitor }].map(option => <Label key={option.value} htmlFor={`mode-${option.value}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft dark:has-[[data-state=checked]]:bg-primary/15">
            <RadioGroupItem id={`mode-${option.value}`} value={option.value} /><option.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{option.label}
          </Label>)}
        </RadioGroup>
      </fieldset>
      <fieldset className="min-w-0"><legend className="mb-3 text-sm font-medium">Ukuran teks</legend>
        <RadioGroup value={preferences.fontSize} onValueChange={fontSize => update({ fontSize: fontSize as FontSize })} aria-label="Ukuran teks" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[{ value: "standard", label: "Standar" }, { value: "large", label: "Besar" }, { value: "extra-large", label: "Sangat besar" }].map(option => <Label key={option.value} htmlFor={`font-${option.value}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft dark:has-[[data-state=checked]]:bg-primary/15">
            <RadioGroupItem id={`font-${option.value}`} value={option.value} />{option.label}
          </Label>)}
        </RadioGroup>
        <p className="mt-2 text-sm text-muted-foreground">Teks, tombol, dan jarak ikut membesar agar tetap mudah digunakan.</p>
      </fieldset>
      <div className="space-y-2 rounded-xl bg-muted/60 p-4" aria-label="Contoh tampilan teks"><p className="font-medium">Catatan usaha, mudah dibaca.</p><p className="text-sm text-muted-foreground">Penjualan dan pembayaran tetap jelas dalam ukuran yang nyaman untuk Anda.</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={`text-sm ${saved ? "text-muted-foreground" : "text-destructive"}`}>{saved ? "Tersimpan otomatis di perangkat ini." : "Pengaturan diterapkan, tetapi browser tidak mengizinkan penyimpanan. Pengaturan dapat hilang setelah halaman ditutup."}</p>
        <Button type="button" variant="outline" onClick={() => update(defaultAppearance)} disabled={preferences.mode === "system" && preferences.fontSize === "standard" && saved}>Kembalikan standar</Button>
      </div>
    </div>
  </section>;
}
