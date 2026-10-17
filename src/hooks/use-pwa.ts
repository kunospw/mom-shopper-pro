import { useEffect, useState } from "react";
import { notificationPermission, pwaState, subscribePwa } from "@/lib/pwa";

/** Install, update and notification state; re-renders when any of it changes. */
export function usePwa() {
  const read = () => ({ ...pwaState(), permission: notificationPermission(), online: navigator.onLine });
  const [state, setState] = useState(read);
  useEffect(() => {
    const refresh = () => setState(read());
    const unsubscribe = subscribePwa(refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    document.addEventListener("visibilitychange", refresh);
    const standalone = window.matchMedia?.("(display-mode: standalone)");
    standalone?.addEventListener?.("change", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      document.removeEventListener("visibilitychange", refresh);
      standalone?.removeEventListener?.("change", refresh);
    };
  }, []);
  return state;
}
