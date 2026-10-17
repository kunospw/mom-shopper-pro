import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

// ---- manifest: installable fields, icons exist with the declared sizes ----
const manifest = JSON.parse(read("public/manifest.webmanifest"));
for (const key of ["name", "short_name", "start_url", "scope", "display", "icons", "theme_color", "background_color"]) assert.ok(manifest[key], `manifest.${key}`);
assert.equal(manifest.display, "standalone");
assert.ok(manifest.start_url.startsWith(manifest.scope), "start_url inside scope");
assert.ok(manifest.short_name.length <= 12, "short_name fits under an icon");
const sizes = new Set();
for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)]) {
  const file = new URL(`public${icon.src}`, root);
  assert.ok(existsSync(file), `icon ${icon.src} exists`);
  const [w, h] = pngSize(readFileSync(file));
  assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} is ${icon.sizes}`);
  sizes.add(icon.sizes);
}
assert.ok(sizes.has("192x192") && sizes.has("512x512"), "192 and 512 icons");
assert.ok(manifest.icons.some((i) => i.purpose === "maskable"), "maskable icon");
assert.deepEqual(pngSize(read("public/apple-touch-icon.png")), [180, 180]);
for (const s of manifest.shortcuts) assert.ok(s.url.startsWith("/") && s.name, "shortcut");

// ---- index.html links the manifest and icons ----
const html = read("index.html").toString();
assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
assert.match(html, /<meta name="theme-color" content="#2F5D46"/);

// ---- service worker: valid script, never touches Firebase/API traffic, precache list exists ----
execFileSync(process.execPath, ["--check", fileURLToPath(new URL("public/sw.js", root))]);
const sw = read("public/sw.js").toString();
assert.match(sw, /if \(request\.method !== "GET"\) return;/, "only GET");
assert.match(sw, /if \(!sameOrigin \|\| url\.pathname\.startsWith\("\/__\/"\)\) return;/, "cross-origin and /__/ untouched");
for (const path of JSON.parse(sw.match(/const PRECACHE = (\[[^\]]*\])/)[1])) {
  if (path === "/") continue;
  assert.ok(existsSync(new URL(`public${path}`, root)), `precached ${path} exists`);
}
const vercel = JSON.parse(read("vercel.json"));
assert.ok(vercel.headers.some((h) => h.source === "/sw.js" && h.headers.some((x) => /no-cache/.test(x.value))), "sw.js not cached by the CDN");

// ---- new-order detection ----
const out = await build({
  entryPoints: [fileURLToPath(new URL("src/lib/order-alerts.ts", root))],
  bundle: true, write: false, platform: "node", format: "esm",
});
const alerts = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
assert.deepEqual(alerts.newOrderIds(null, ["a", "b"]), [], "first snapshot announces nothing");
assert.deepEqual(alerts.newOrderIds(new Set(["a"]), ["a", "b", "c"]), ["b", "c"]);
assert.deepEqual(alerts.newOrderIds(new Set(["a", "b"]), ["b"]), [], "a handled order is not new");
assert.deepEqual(alerts.defaultAlertPrefs, { sound: true, notify: true });

console.log("pwa: manifest, icons, service worker, Vercel headers, new-order detection: PASS");
