import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppearanceContext } from "@/lib/appearance-context";
import { appearanceKey, fontScales, normalizeAppearance, readAppearance, type AppearancePreferences } from "@/lib/appearance";

function AppearanceSession({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => readAppearance(storageKey));
  const [saved, setSaved] = useState(true);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolvedMode = preferences.mode === "system" ? (systemDark ? "dark" : "light") : preferences.mode;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => setSystemDark(media.matches);
    followSystem(); media.addEventListener("change", followSystem);
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        setPreferences(readAppearance(storageKey)); setSaved(true);
      }
    };
    window.addEventListener("storage", sync);
    return () => { media.removeEventListener("change", followSystem); window.removeEventListener("storage", sync); };
  }, [storageKey]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedMode === "dark");
    root.style.colorScheme = resolvedMode;
    root.style.fontSize = fontScales[preferences.fontSize];
    return () => { root.classList.remove("dark"); root.style.removeProperty("color-scheme"); root.style.removeProperty("font-size"); };
  }, [resolvedMode, preferences.fontSize]);

  function update(changes: Partial<AppearancePreferences>) {
    const next = normalizeAppearance({ ...preferences, ...changes });
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(true); }
    catch { setSaved(false); }
  }
  return <AppearanceContext.Provider value={{ preferences, resolvedMode, saved, update }}>{children}</AppearanceContext.Provider>;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = appearanceKey(user?.uid);
  return <AppearanceSession key={storageKey} storageKey={storageKey}>{children}</AppearanceSession>;
}
