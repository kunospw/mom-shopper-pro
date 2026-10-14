import { createContext } from "react";
import type { AppearancePreferences } from "./appearance";
export const AppearanceContext = createContext<{
  preferences: AppearancePreferences;
  resolvedMode: "light" | "dark";
  saved: boolean;
  update: (changes: Partial<AppearancePreferences>) => void;
} | null>(null);
