import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Download, PlusSquare, Share, Smartphone, Volume2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwa } from "@/hooks/use-pwa";
import { applyUpdate, promptInstall, requestNotifications, showNotification } from "@/lib/pwa";
import { playChime, readAlertPrefs, writeAlertPrefs, type AlertPrefs } from "@/lib/order-alerts";
import { cn } from "@/lib/utils";

function IosSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle>Pasang di iPhone</DialogTitle>
          <DialogDescription>Buka halaman ini di Safari, lalu:</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">1</span>
            <span>Ketuk tombol <Share className="mx-0.5 inline h-4 w-4" aria-label="Bagikan" /> <strong>Bagikan</strong> di bawah layar.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">2</span>
            <span>Pilih <PlusSquare className="mx-0.5 inline h-4 w-4" aria-hidden="true" /> <strong>Tambahkan ke Layar Utama</strong>.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">3</span>
            <span>Ketuk <strong>Tambah</strong>. Buka aplikasinya dari ikon di layar utama.</span>
          </li>
        </ol>
        <Button className="mt-2" onClick={() => onOpenChange(false)}>Mengerti</Button>
      </DialogContent>
    </Dialog>
  );
}

/** "Pasang aplikasi" link for the sidebar and the phone menu; hidden once installed or where it can't be installed. */
export function InstallAppButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const pwa = usePwa();
  const [ios, setIos] = useState(false);
  if (pwa.standalone || (!pwa.canPrompt && !pwa.ios)) return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (pwa.canPrompt) {
            const outcome = await promptInstall();
            if (outcome === "accepted") toast.success("Aplikasi dipasang. Buka dari layar utama.");
            onDone?.();
          } else setIos(true);
        }}
        className={cn("flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm text-foreground/85 transition-colors hover:bg-accent hover:text-foreground", className)}
      >
        <Smartphone className="h-[18px] w-[18px]" aria-hidden="true" />
        Pasang aplikasi
      </button>
      <IosSteps open={ios} onOpenChange={setIos} />
    </>
  );
}

/** Shows "versi baru tersedia" once, and a small strip while offline. */
export function AppStatus() {
  const pwa = usePwa();
  const shown = useRef(false);
  useEffect(() => {
    if (!pwa.updateReady || shown.current) return;
    shown.current = true;
    toast("Versi baru tersedia", {
      description: "Muat ulang untuk memakai versi terbaru.",
      duration: Infinity,
      action: { label: "Muat ulang", onClick: () => applyUpdate() },
    });
  }, [pwa.updateReady]);
  if (pwa.online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-center text-xs font-medium text-background">
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Anda sedang offline. Perubahan baru bisa disimpan setelah tersambung lagi.
    </div>
  );
}

/** Pengaturan → Tampilan: install the app and new-order alerts. */
export function AppSettings() {
  const pwa = usePwa();
  const [prefs, setPrefs] = useState<AlertPrefs>(readAlertPrefs);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const sync = () => setPrefs(readAlertPrefs());
    window.addEventListener("order-alert-prefs", sync);
    return () => window.removeEventListener("order-alert-prefs", sync);
  }, []);
  const update = (next: Partial<AlertPrefs>) => {
    const value = { ...prefs, ...next };
    setPrefs(value);
    writeAlertPrefs(value);
  };
  const blocked = pwa.permission === "denied";
  const granted = pwa.permission === "granted";

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h3 className="text-base font-semibold">Aplikasi & notifikasi</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">Pasang di layar utama dan dapat kabar saat ada pesanan baru. Berlaku untuk perangkat ini.</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex min-w-0 items-start gap-3">
          <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Mom Shopper di layar utama</p>
            <p className="text-xs text-muted-foreground">
              {pwa.standalone
                ? "Sudah terpasang. Anda sedang memakai aplikasinya."
                : pwa.canPrompt
                  ? "Buka lebih cepat, layar penuh, tanpa bilah alamat."
                  : pwa.ios
                    ? "Di iPhone, pasang lewat tombol Bagikan di Safari."
                    : "Buka di Chrome (Android/komputer) atau Safari (iPhone) untuk memasang."}
            </p>
          </div>
        </div>
        {!pwa.standalone && (pwa.canPrompt || pwa.ios) && (
          <Button
            variant="outline"
            onClick={async () => {
              if (pwa.canPrompt) {
                if ((await promptInstall()) === "accepted") toast.success("Aplikasi dipasang. Buka dari layar utama.");
              } else setIos(true);
            }}
          >
            <Download /> Pasang aplikasi
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-1 rounded-xl border p-4">
        <p className="text-sm font-semibold">Pesanan baru</p>
        <p className="text-xs text-muted-foreground">
          Muncul selama aplikasi terbuka, termasuk saat berjalan di latar belakang. Saat aplikasi ditutup, pesanan tetap masuk lewat WhatsApp dari pembeli.
        </p>
        <div className="flex items-center justify-between gap-3 pt-3">
          <Label htmlFor="alert-sound" className="flex items-center gap-2 font-normal">
            <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Bunyi
          </Label>
          <Switch id="alert-sound" checked={prefs.sound} onCheckedChange={(sound) => { update({ sound }); if (sound) playChime(); }} />
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <Label htmlFor="alert-notify" className="flex items-center gap-2 font-normal">
            {granted && prefs.notify ? <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            Notifikasi di layar
          </Label>
          <Switch
            id="alert-notify"
            checked={prefs.notify && granted}
            disabled={blocked || pwa.permission === "unsupported"}
            onCheckedChange={async (on) => {
              if (on && !granted) {
                const result = await requestNotifications();
                if (result !== "granted") {
                  toast.error(result === "denied" ? "Notifikasi diblokir. Izinkan dari pengaturan browser." : "Notifikasi belum diizinkan.");
                  return;
                }
              }
              update({ notify: on });
            }}
          />
        </div>
        <p className="pt-1 text-xs text-muted-foreground" role="status">
          {pwa.permission === "unsupported"
            ? pwa.ios
              ? "Di iPhone, notifikasi tersedia setelah aplikasi dipasang ke layar utama (iOS 16.4 ke atas)."
              : "Browser ini tidak mendukung notifikasi."
            : blocked
              ? "Notifikasi diblokir untuk situs ini. Izinkan dari pengaturan browser, lalu muat ulang."
              : granted
                ? "Notifikasi diizinkan."
                : "Nyalakan untuk meminta izin notifikasi."}
        </p>
        {granted && prefs.notify && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => {
              if (prefs.sound) playChime();
              void showNotification("Contoh pesanan baru", "#TEST01 · 2 produk · Rp 150.000", "/orders", "test");
            }}
          >
            Coba notifikasi
          </Button>
        )}
      </div>
      <IosSteps open={ios} onOpenChange={setIos} />
    </section>
  );
}
