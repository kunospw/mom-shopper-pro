import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getEntitlement } from "@/lib/entitlement-storage";
import { graceEndFromEnv, planState, type Entitlement, type PlanState } from "@/lib/entitlement";
import { UpgradeDialog } from "@/components/UpgradeDialog";

const graceEnd = graceEndFromEnv(import.meta.env.VITE_GRACE_END);

interface PlanValue {
  entitlement: Entitlement | null;
  plan: PlanState;
  loaded: boolean;
  failed: boolean;
  graceEnd: Date | null;
  /** Re-reads the entitlement (after starting the trial, or after paying). Resolves with the new state. */
  reload: () => Promise<PlanState>;
  openUpgrade: () => void;
}
const PlanContext = createContext<PlanValue | null>(null);

/** One plan read per workspace session, shared by the notice, sidebar, settings, catalog and paywall. */
export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const value = await getEntitlement();
      setEntitlement(value);
      setFailed(false);
      return planState(value, new Date(), graceEnd);
    } catch {
      setFailed(true);
      return planState(null, new Date(), graceEnd);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  const value = useMemo<PlanValue>(
    () => ({
      entitlement,
      plan: planState(entitlement, new Date(), graceEnd),
      loaded,
      failed,
      graceEnd,
      reload,
      openUpgrade: () => setUpgradeOpen(true),
    }),
    [entitlement, loaded, failed, reload],
  );
  return (
    <PlanContext.Provider value={value}>
      {children}
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </PlanContext.Provider>
  );
}

export function usePlanContext() {
  const value = useContext(PlanContext);
  if (!value) throw new Error("usePlan must be used inside PlanProvider");
  return value;
}
