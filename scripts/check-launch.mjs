import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

// Public launch surface: in-app browser detection, link preview tags, robots and sitemap, public routes.
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
async function load(file) {
  const { outputText } = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

// ---- in-app browsers (Google sign-in fails there) ----
const { inAppBrowser, chromeIntent } = await load("src/lib/in-app-browser.ts");
const chromeAndroid = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
for (const ua of [chromeAndroid, safari, desktop, ""]) assert.equal(inAppBrowser(ua), null, ua);
for (const [ua, app] of [
  [`${chromeAndroid.replace(")", "; wv)")} Instagram 340.0.0.22.109 Android`, "Instagram"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 [FBAN/FBIOS;FBAV/470.0.0;FBBV/1]", "Facebook"],
  [`${chromeAndroid} [FB_IAB/FB4A;FBAV/470.0.0.0;]`, "Facebook"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 musical_ly_35.2.0 BytedanceWebview/d8a21c6", "TikTok"],
  [`${chromeAndroid} Line/14.9.1`, "LINE"],
  [`${chromeAndroid} WhatsApp/2.24.12.78`, "WhatsApp"],
  [chromeAndroid.replace(")", "; wv)"), "aplikasi ini"],
])
  assert.equal(inAppBrowser(ua), app, ua);
assert.equal(inAppBrowser("Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/127.0 Timeline/1.0"), null, "word boundary on Line/");
assert.equal(
  chromeIntent("https://larisku.example/login?next=%2Fcatalog#x", chromeAndroid),
  "intent://larisku.example/login?next=%2Fcatalog#Intent;scheme=https;package=com.android.chrome;end",
);
assert.equal(chromeIntent("https://larisku.example/login", safari), null, "iOS has no intent links");
assert.equal(chromeIntent("http://localhost:8099/login", chromeAndroid), "intent://localhost:8099/login#Intent;scheme=http;package=com.android.chrome;end");
assert.equal(chromeIntent("javascript:alert(1)", chromeAndroid), null, "web pages only");
assert.equal(chromeIntent("not a url", chromeAndroid), null);

// ---- link preview: absolute image of the size the tags declare ----
const html = read("index.html");
const image = html.match(/<meta property="og:image" content="(https:\/\/[^"]+)\/og-image\.png" \/>/);
assert.ok(image, "og:image is an absolute https URL");
assert.ok(html.includes(`<meta name="twitter:image" content="${image[1]}/og-image.png" />`));
assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
assert.match(html, /<meta property="og:image:height" content="630" \/>/);
assert.ok(existsSync(new URL("public/og-image.png", root)), "public/og-image.png exists (node scripts/make-og-image.mjs)");
const png = readFileSync(new URL("public/og-image.png", root));
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
assert.ok(png.length < 300_000, "WhatsApp skips large preview images");

// ---- robots and sitemap: same origin as the preview image, real XML, no private pages ----
const robots = read("public/robots.txt");
assert.ok(robots.includes(`Sitemap: ${image[1]}/sitemap.xml`));
assert.match(robots, /Disallow: \/shop\/\*\/order\//, "order status links stay out of search engines");
const sitemap = read("public/sitemap.xml");
assert.ok(sitemap.startsWith("<?xml"));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.deepEqual(locs, [`${image[1]}/`, `${image[1]}/privasi`, `${image[1]}/ketentuan`]);

// ---- every sitemap page and legal link is a real route ----
const app = read("src/App.tsx");
for (const path of ["/privasi", "/ketentuan", "/login"]) assert.ok(app.includes(`path: "${path}"`), path);
const guard = read("src/components/ProtectedRoute.tsx");
assert.match(guard, /location\.pathname === '\/' && !installed/, "landing only at the front door, never for the installed app");
// shop slugs live under /shop/, so the new top-level paths cannot collide with a shop link
assert.ok(app.includes('path: "/shop/:store"'));

console.log("PASS: launch surface (in-app browsers, link preview, robots, sitemap, public routes).");
