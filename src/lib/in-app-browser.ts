/**
 * Browsers embedded in chat and social apps block Google's sign-in popup (and
 * Google refuses sign-in inside them). Sellers mostly arrive from exactly these
 * apps, so the login page names the app and offers a way out.
 */
const apps: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/\bLine\//i, "LINE"],
  [/WhatsApp/i, "WhatsApp"],
  [/Telegram/i, "Telegram"],
  [/MicroMessenger/i, "WeChat"],
  [/Twitter/i, "X"],
];

/** The embedding app's name, "aplikasi ini" for an unnamed Android WebView, or null in a real browser. */
export function inAppBrowser(userAgent: string): string | null {
  for (const [pattern, name] of apps) if (pattern.test(userAgent)) return name;
  // Android WebView marks itself with "; wv)".
  if (/Android/i.test(userAgent) && /;\s*wv\)/i.test(userAgent)) return "aplikasi ini";
  return null;
}

/** Android only: a link that reopens the page in Chrome. iOS has no equivalent. */
export function chromeIntent(href: string, userAgent: string): string | null {
  if (!/Android/i.test(userAgent)) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;end`;
}
