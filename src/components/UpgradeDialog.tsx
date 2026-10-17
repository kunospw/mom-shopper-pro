import { useState } from "react";
import { Check, CircleCheck, Loader2, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanContext } from "@/contexts/PlanContext";
import { useOptionalBooks } from "@/contexts/BooksContext";
import { PLAN_PRICE_IDR, UPGRADE_WHATSAPP, accountCode, planLine, upgradeLink, upgradeMessage } from "@/lib/plan-config";
import { cn } from "@/lib/utils";

const included = [
  "Katalog online dengan tautan toko sendiri",
  "Pesanan pembeli langsung ke WhatsApp",
  "Halaman lacak pesanan untuk pembeli",
  "Kit promosi: pesan siaran dan gambar status",
];
const free = ["Pencatatan penjualan, DP, dan pelunasan", "Pembelian stok dan biaya", "Laporan untung rugi dan invoice"];

/**
 * The paywall. Payment happens off-platform: the owner messages the operator on
 * WhatsApp, pays, and the operator sets `paidUntil`. "Saya sudah bayar" re-reads it.
 */
export function UpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const books = useOptionalBooks();
  const { plan, reload } = usePlanContext();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<"" | "active" | "pending">("");
  const shopName = books?.store?.name || user?.businessName || "";
  const message = user ? upgradeMessage({ shopName, email: user.email, uid: user.uid, plan }) : "";
  const link = message ? upgradeLink(message) : null;

  async function check() {
    setChecking(true);
    setChecked("");
    const next = await reload();
    setChecked(next.phase === "paid" ? "active" : "pending");
    setChecking(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setChecked("");
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader className="text-left">
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl">{plan.phase === "paid" ? "Paket Anda aktif" : "Buka toko tanpa batas"}</DialogTitle>
          <DialogDescription>{planLine(plan)}.</DialogDescription>
        </DialogHeader>

        <section aria-label="Paket bulanan" className="rounded-2xl border-[1.5px] border-primary/40 p-5">
          <p className="text-[13px] font-semibold text-primary-ink dark:text-primary">Paket Toko</p>
          {PLAN_PRICE_IDR > 0 ? (
            <p className="mt-1 flex items-baseline gap-1">
              <span className="num text-[30px] font-bold tracking-tight">Rp {PLAN_PRICE_IDR.toLocaleString("id-ID")}</span>
              <span className="text-sm text-muted-foreground">/ bulan</span>
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold">Hubungi kami untuk harga</p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {included.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Selalu gratis" className="rounded-xl bg-background p-4 text-[13px]">
          <p className="font-semibold">Selalu gratis, dengan atau tanpa paket</p>
          <ul className="mt-1.5 space-y-1 text-muted-foreground">
            {free.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </section>

        {plan.phase !== "paid" && (
          <div className="space-y-2.5">
            {link ? (
              <Button asChild className="h-12 w-full rounded-xl bg-[#1F7A4A] text-[15px] text-white hover:bg-[#1F7A4A]/90">
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Upgrade lewat WhatsApp
                </a>
              </Button>
            ) : (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Hubungi pengelola aplikasi untuk berlangganan.</p>
            )}
            <Button type="button" variant="outline" className="h-11 w-full rounded-xl" disabled={checking} onClick={() => void check()}>
              {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Saya sudah bayar, periksa lagi
            </Button>
            <p role="status" className={cn("text-[13px]", checked === "active" ? "font-semibold text-success" : "text-muted-foreground")}>
              {checked === "active"
                ? "Paket aktif. Terima kasih!"
                : checked === "pending"
                  ? "Belum aktif. Aktivasi dilakukan manual, biasanya kurang dari 1×24 jam setelah pembayaran."
                  : `Pembayaran lewat WhatsApp, lalu kami aktifkan manual. Sebutkan kode akun ${user ? accountCode(user.uid) : ""}.`}
            </p>
          </div>
        )}
        {plan.phase === "paid" && (
          <div role="status" className="flex items-start gap-2 rounded-xl bg-success-soft p-3 text-sm text-success">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {checked === "active" && <strong className="block">Paket aktif. Terima kasih!</strong>}
              Untuk memperpanjang, hubungi kami{UPGRADE_WHATSAPP ? " lewat WhatsApp" : ""} sebelum masa aktif berakhir.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
