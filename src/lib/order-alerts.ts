/** Per-device preferences for new-order alerts (sound and system notification). */
export interface AlertPrefs {
  sound: boolean;
  notify: boolean;
}
const KEY = "ruang-usaha:order-alerts";
export const defaultAlertPrefs: AlertPrefs = { sound: true, notify: true };

export function readAlertPrefs(): AlertPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return { ...defaultAlertPrefs, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return defaultAlertPrefs;
  }
}
export function writeAlertPrefs(prefs: AlertPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Private mode: preferences last for this visit only. */
  }
  window.dispatchEvent(new Event("order-alert-prefs"));
}

/** Short two-note chime made with Web Audio (no sound file to download). */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [880, 1318.5].forEach((frequency, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.35);
      osc.connect(gain).connect(context.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.4);
    });
    window.setTimeout(() => void context.close().catch(() => undefined), 1000);
  } catch {
    /* Audio blocked (no user gesture yet); the toast and notification still show. */
  }
}

/** Order IDs that are new compared to the ones already seen. */
export function newOrderIds(previous: Set<string> | null, current: string[]) {
  if (!previous) return [];
  return current.filter((id) => !previous.has(id));
}
