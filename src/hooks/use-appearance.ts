import { useContext } from "react";
import { AppearanceContext } from "@/lib/appearance-context";
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance requires AppearanceProvider");
  return context;
}
