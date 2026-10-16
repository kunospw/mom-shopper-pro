import { Link } from "react-router-dom";
import { CircleCheck, Hourglass, Sparkles } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

/** Compact plan status in the navigation; opens Settings → Langganan. Hidden until loaded or when nothing started. */
export function PlanPill({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { plan, loaded } = usePlan();
  if (!loaded || plan.phase === "none") return null;
  const view =
    plan.phase === "paid"
      ? { Icon: CircleCheck, text: "Paket aktif", tone: "bg-success-soft text-success" }
      : plan.phase === "trial"
        ? { Icon: Sparkles, text: `Uji coba · ${plan.daysLeft} hari`, tone: "bg-info-soft text-info" }
        : plan.phase === "grace"
          ? { Icon: Sparkles, text: "Aktifkan uji coba", tone: "bg-warning-soft text-warning" }
          : { Icon: Hourglass, text: "Masa uji coba berakhir", tone: "bg-destructive-soft text-destructive" };
  return (
    <Link
      to="/settings/plan"
      onClick={onNavigate}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        view.tone,
        className,
      )}
    >
      <view.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{view.text}</span>
      <span className="sr-only">, buka pengaturan langganan</span>
    </Link>
  );
}
