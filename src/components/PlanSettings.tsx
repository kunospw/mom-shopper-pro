import { useState } from "react";
import { CalendarDays, CircleCheck, Hourglass, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/use-plan";
import { useAuth } from "@/contexts/AuthContext";
import { startTrial } from "@/lib/entitlement-storage";
import { PLAN_PRICE_IDR, accountCode, planLine } from "@/lib/plan-config";
import { TRIAL_DAYS } from "@/lib/entitlement";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const date = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

/** Settings → Langganan: where the plan stands, and the way to upgrade. */
export function PlanSettings() {
  const { user } = useAuth();
  const { plan, entitlement, loaded, failed, reload, openUpgrade } = usePlan();
  const [starting, setStarting] = useState(false);
  if (!loaded) return <p role="status" className="text-sm text-muted-foreground">Memuat langganan…</p>;
  const status =
    plan.phase === "paid"
      ? { Icon: CircleCheck, title: "Paket aktif", tone: "bg-success-soft text-success" }
      : plan.phase === "trial"
        ? { Icon: Sparkles, title: `Uji coba gratis · sisa ${plan.daysLeft} hari`, tone: "bg-info-soft text-info" }
        : plan.phase === "grace"
          ? { Icon: Sparkles, title: "Toko lama, belum memulai uji coba", tone: "bg-warning-soft text-warning" }
          : plan.phase === "expired"
            ? { Icon: Hourglass, title: "Masa uji coba berakhir", tone: "bg-destructive-soft text-destructive" }
            : { Icon: Sparkles, title: "Belum memulai uji coba", tone: "bg-muted text-foreground" };

  async function begin() {
    setStarting(true);
    try {
      await startTrial();
      await reload();
      toast.success("Uji coba 7 hari dimulai");
    } catch {
      toast.error("Uji coba belum bisa dimulai. Pastikan toko sudah dibuka, lalu coba lagi.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      {failed && <p role="alert" className="text-sm text-destructive">Status langganan belum dapat dimuat. Periksa koneksi Anda.</p>}
      <div className={cn("flex items-start gap-3 rounded-2xl p-5", status.tone)}>
        <status.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{status.title}</p>
          <p className="text-sm">{planLine(plan)}.</p>
        </div>
      </div>
      <dl className="grid gap-3 rounded-2xl border bg-card p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Uji coba dimulai</dt>
          <dd className="font-medium">{date(entitlement?.trialStartedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Uji coba berakhir</dt>
          <dd className="font-medium">
            {entitlement?.trialStartedAt ? date(new Date(new Date(entitlement.trialStartedAt).getTime() + TRIAL_DAYS * 86_400_000)) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paket aktif sampai</dt>
          <dd className="font-medium">{date(entitlement?.paidUntil)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kode akun</dt>
          <dd className="font-mono font-medium">{user ? accountCode(user.uid) : "—"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-11 rounded-xl" onClick={openUpgrade}>
          <CalendarDays /> {plan.phase === "paid" ? "Perpanjang paket" : `Lihat paket${PLAN_PRICE_IDR ? ` · Rp ${PLAN_PRICE_IDR.toLocaleString("id-ID")}/bulan` : ""}`}
        </Button>
        {plan.phase === "grace" && (
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={starting} onClick={() => void begin()}>
            {starting ? "Memulai…" : "Mulai uji coba 7 hari"}
          </Button>
        )}
      </div>
      <p className="flex gap-2 rounded-xl bg-background p-4 text-[13px] text-muted-foreground">
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
        Pencatatan penjualan, pembayaran, biaya, dan laporan tetap gratis selamanya. Paket hanya membuka katalog online dan pesanan dari pembeli.
      </p>
    </div>
  );
}
