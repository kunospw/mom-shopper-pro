import { useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Copy,
  Hourglass,
  Package,
  Send,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { fulfillmentLabels, paymentLabels } from "@/lib/books";
import { cn } from "@/lib/utils";
import type { FulfillmentStatus, PaymentState } from "@/types/books";

/**
 * The three status axes of the design must never be mixed up, and none relies on
 * color alone (each has an icon or dot shape plus text):
 *  - request (from the catalog, not yet a sale): clay, dashed, "#CODE"
 *  - payment: filled pill with a hollow / half / solid dot
 *  - fulfillment: outlined chip with a step icon
 */
const pill = "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold";

const dotClass: Record<PaymentState, string> = {
  unpaid: "border-[1.5px] border-current bg-transparent",
  partial: "border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]",
  paid: "border-[1.5px] border-current bg-current",
};
const paymentTone: Record<PaymentState, string> = {
  unpaid: "bg-destructive-soft text-destructive",
  partial: "bg-warning-soft text-warning",
  paid: "bg-success-soft text-success",
};

export function PaymentChip({
  state,
  className,
}: {
  state: PaymentState | "refund-due";
  className?: string;
}) {
  if (state === "refund-due")
    return (
      <span className={cn(pill, "bg-request-soft text-request", className)}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        Perlu dikembalikan
      </span>
    );
  return (
    <span className={cn(pill, paymentTone[state], className)}>
      <span aria-hidden="true" className={cn("h-[7px] w-[7px] shrink-0 rounded-full", dotClass[state])} />
      {paymentLabels[state]}
    </span>
  );
}

const fulfillmentIcon: Record<FulfillmentStatus, LucideIcon> = {
  confirmed: ClipboardCheck,
  packed: Package,
  shipped: Truck,
  delivered: Send,
  done: CheckCheck,
  cancelled: Ban,
};
const fulfillmentTone: Record<FulfillmentStatus, string> = {
  confirmed: "border-foreground/20 text-foreground/80",
  packed: "border-foreground/20 text-foreground/80",
  shipped: "border-info/35 text-info",
  delivered: "border-info/35 text-info",
  done: "border-success/35 text-success",
  cancelled: "border-border text-muted-foreground line-through",
};

export function FulfillmentChip({
  status,
  className,
}: {
  status: FulfillmentStatus;
  className?: string;
}) {
  const Icon = fulfillmentIcon[status];
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-xs font-medium",
        fulfillmentTone[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {fulfillmentLabels[status]}
    </span>
  );
}

export type RequestStatus = "pending" | "confirmed" | "rejected";
const requestLabel: Record<RequestStatus, string> = {
  pending: "Menunggu konfirmasi",
  confirmed: "Dikonfirmasi",
  rejected: "Ditolak",
};
const requestIcon: Record<RequestStatus, LucideIcon> = {
  pending: Hourglass,
  confirmed: CircleCheck,
  rejected: CircleX,
};
const requestTone: Record<RequestStatus, string> = {
  pending: "bg-request-soft text-request",
  confirmed: "bg-success-soft text-success",
  rejected: "bg-muted text-muted-foreground",
};

export function RequestChip({ status, className }: { status: RequestStatus; className?: string }) {
  const Icon = requestIcon[status];
  return (
    <span className={cn(pill, requestTone[status], className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {requestLabel[status]}
    </span>
  );
}

/** A catalog request that is not yet a sale: dashed clay ticket with a mono code. */
export function RequestTicket({
  code,
  title,
  meta,
  amountLabel = "Estimasi subtotal",
  amount,
  className,
  children,
}: {
  code: string;
  title: string;
  meta?: string;
  amountLabel?: string;
  amount?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-[1.5px] border-dashed border-request/40 bg-request-soft/50 px-3.5 py-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-request">
            Permintaan #{code}
          </p>
          <p className="truncate text-sm font-semibold">{title}</p>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
        {amount && (
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted-foreground">{amountLabel}</p>
            <p className="num text-sm font-bold">{amount}</p>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Mono order/invoice code. With `copyable`, a keyboard-reachable button copies it. */
export function CodeBadge({
  code,
  prefix = "#",
  copyable = false,
  className,
}: {
  code: string;
  prefix?: string;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = `${prefix}${code}`;
  const base = "inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-semibold";
  if (!copyable) return <span className={cn(base, className)}>{text}</span>;
  return (
    <span className={cn(base, className)}>
      {text}
      <button
        type="button"
        aria-label={`Salin kode ${text}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            /* Clipboard may be blocked; the code stays visible to copy by hand. */
          }
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Kode disalin" : ""}
      </span>
    </span>
  );
}

/** Paid versus balance: a progress bar with a text alternative. */
export function PaidBar({ paid, total, className }: { paid: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Pembayaran"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}% dibayar`}
      className={cn("h-2 overflow-hidden rounded-full bg-clay/25", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
