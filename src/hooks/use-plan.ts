import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getEntitlement } from "@/lib/entitlement-storage";
import { graceEndFromEnv, planState, type Entitlement, type PlanState } from "@/lib/entitlement";

const graceEnd = graceEndFromEnv(import.meta.env.VITE_GRACE_END);

/** The signed-in owner's plan, read once per mount; `reload` after a save that may start the trial. */
export function usePlan() {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getEntitlement()
      .then((value) => {
        if (!active) return;
        setEntitlement(value);
        setFailed(false);
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [user, tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  const plan: PlanState = planState(entitlement, new Date(), graceEnd);
  return { entitlement, plan, loaded, failed, reload, graceEnd };
}
