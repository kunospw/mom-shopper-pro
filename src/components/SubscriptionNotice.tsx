import { CalendarClock, Hourglass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanState } from "@/lib/entitlement";

const date = (value: Date | null) =>
  value ? value.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";

/**
 * A quiet status line for the plan. Pricing and the upgrade contact come with the
 * paywall; this only says where the shop stands. Shows nothing for paid plans and
 * for shops that never opened a catalog.
 */
export function SubscriptionNotice({
  plan,
  published,
  onStart,
  starting = false,
  className,
}: {
  plan: PlanState;
  published: boolean;
  /** Starts the trial for an older open shop that has none yet. */
  onStart?: () => void;
  starting?: boolean;
  className?: string;
}) {
  let tone = "";
  let Icon = Sparkles;
  let title = "";
  let body = "";
  if (plan.phase === "trial") {
    tone = "bg-info-soft text-info";
    title = plan.daysLeft <= 1 ? "Uji coba gratis berakhir hari ini" : `Uji coba gratis: sisa ${plan.daysLeft} hari`;
    body = `Katalog dan pesanan terbuka sampai ${date(plan.endsAt)}. Pencatatan transaksi tetap gratis.`;
  } else if (plan.phase === "grace" && published) {
    tone = "bg-warning-soft text-warning";
    Icon = CalendarClock;
    title = `Aktifkan uji coba sebelum ${date(plan.endsAt)}`;
    body = "Toko Anda tetap terbuka sampai tanggal itu. Setelahnya katalog perlu uji coba atau paket aktif.";
  } else if (plan.phase === "expired" || (plan.phase === "none" && published)) {
    tone = "bg-destructive-soft text-destructive";
    Icon = Hourglass;
    title = "Masa uji coba berakhir";
    body = "Katalog tidak menampilkan produk dan tidak menerima pesanan baru. Pesanan yang sudah masuk, status pelacakan, dan pencatatan transaksi tetap bisa dipakai.";
  } else return null;
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-xl px-4 py-3", tone, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm">{body}</p>
        {plan.phase === "grace" && onStart && (
          <Button type="button" size="sm" variant="outline" className="mt-2 bg-card text-foreground" disabled={starting} onClick={onStart}>
            {starting ? "Memulai…" : "Mulai uji coba 7 hari"}
          </Button>
        )}
      </div>
    </div>
  );
}
