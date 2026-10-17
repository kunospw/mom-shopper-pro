/**
 * Installable app (PWA) helpers: service worker registration, the browser's
 * install prompt, "new version" detection and app notifications. Everything
 * degrades quietly where the browser has no support.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
export function subscribePwa(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

let installEvent: InstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let installed = false;

/** Buyer pages are part of the seller's shop, not the seller app: no install prompt there. */
export const isBuyerPath = (path = location.pathname) => path.startsWith("/shop/");

export function isStandalone() {
  return (
    installed ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
/** iPhone/iPad Safari has no install prompt; the owner adds it from the Share menu. */
export function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function pwaState() {
  return {
    canPrompt: !!installEvent,
    standalone: isStandalone(),
    ios: isIos(),
    updateReady: !!waitingWorker,
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!installEvent) return "unavailable";
  const event = installEvent;
  installEvent = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  emit();
  return outcome;
}

export function applyUpdate() {
  if (!waitingWorker) return location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  waitingWorker.postMessage("SKIP_WAITING");
}

/** Called once from main.tsx, before React renders, so an early install event is not missed. */
export function setupPwa() {
  if (isBuyerPath()) {
    // Keep buyers from being offered the seller app.
    document.querySelector('link[rel="manifest"]')?.remove();
    return;
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    installEvent = null;
    emit();
  });
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            // A new worker waiting while an old one controls the page = a new version is ready.
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              emit();
            }
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          emit();
        }
        registration.addEventListener("updatefound", () => track(registration.installing));
        // Check for a new version when the owner comes back to the app.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}

export type NotifyPermission = NotificationPermission | "unsupported";
export function notificationPermission(): NotifyPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}
export async function requestNotifications(): Promise<NotifyPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  emit();
  return result;
}

/** System notification; through the service worker when there is one (required on Android). */
export async function showNotification(title: string, body: string, url: string, tag?: string) {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag, data: { url } };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options).onclick = () => {
      window.focus();
      location.assign(url);
    };
    return true;
  } catch {
    return false;
  }
}
