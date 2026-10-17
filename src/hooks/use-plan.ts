import { usePlanContext } from "@/contexts/PlanContext";

/** The signed-in owner's plan (shared across the workspace) and the paywall opener. */
export function usePlan() {
  return usePlanContext();
}
