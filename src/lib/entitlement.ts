/**
 * Plan state for a shop, derived from the owner's entitlement document.
 * Firestore rules make the same decision on the server; this only decides what
 * the interface shows. See docs/subscription.md.
 */
export const TRIAL_DAYS = 7;
const DAY = 86_400_000;

export interface Entitlement {
  /** ISO time the trial began (server time). */
  trialStartedAt: string;
  /** ISO time paid access ends, set by the operator. Null while on trial. */
  paidUntil: string | null;
}

export type PlanPhase =
  /** Trial running. */
  | "trial"
  /** Paid access running. */
  | "paid"
  /** Trial or paid period ended. */
  | "expired"
  /** Older shop without an entitlement, still open until the grace period ends. */
  | "grace"
  /** No entitlement and not in grace: nothing started yet (or grace ended). */
  | "none";

export interface PlanState {
  phase: PlanPhase;
  /** Whole days left, rounded up; 0 when not running. */
  daysLeft: number;
  /** When the current access ends (trial, paid or grace); null if none. */
  endsAt: Date | null;
  /** Whether new buyer requests and public products are served right now. */
  active: boolean;
}

const time = (value: string | null | undefined) => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function graceEndFromEnv(value: string | undefined): Date | null {
  const parsed = time(value);
  return parsed === null ? null : new Date(parsed);
}

export function planState(
  entitlement: Entitlement | null,
  now: Date,
  graceEnd: Date | null,
): PlanState {
  const at = now.getTime();
  const left = (end: number) => Math.max(0, Math.ceil((end - at) / DAY));
  if (!entitlement) {
    if (graceEnd && at < graceEnd.getTime())
      return { phase: "grace", daysLeft: left(graceEnd.getTime()), endsAt: graceEnd, active: true };
    return { phase: "none", daysLeft: 0, endsAt: null, active: false };
  }
  const paid = time(entitlement.paidUntil);
  const start = time(entitlement.trialStartedAt);
  if (paid !== null && at < paid)
    return { phase: "paid", daysLeft: left(paid), endsAt: new Date(paid), active: true };
  if (start !== null) {
    const end = start + TRIAL_DAYS * DAY;
    if (at < end) return { phase: "trial", daysLeft: left(end), endsAt: new Date(end), active: true };
    return { phase: "expired", daysLeft: 0, endsAt: new Date(paid !== null ? Math.max(end, paid) : end), active: false };
  }
  // Malformed record: fail closed rather than showing access that rules would deny.
  return { phase: "expired", daysLeft: 0, endsAt: null, active: false };
}

/**
 * Opening a closed shop needs a running trial/plan, or none recorded yet (then the
 * save starts the trial). An expired owner cannot reopen. An already open shop
 * can always be edited. Mirrors the publish gate in firestore.rules.
 */
export function canPublish(plan: PlanState, alreadyPublished: boolean) {
  return alreadyPublished || plan.phase !== "expired";
}

/** Saving a published shop starts the trial exactly when no entitlement exists yet. */
export function needsTrialStart(entitlement: Entitlement | null, publishing: boolean) {
  return publishing && !entitlement;
}
