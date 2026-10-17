import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Reads the real tokens (src/index.css) and accents (src/lib/branding.ts) so the
// check cannot drift from what ships. WCAG 2.x: 4.5:1 for text, 3:1 for UI parts.
const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
const branding = await readFile(new URL("../src/lib/branding.ts", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert(start >= 0, `missing ${selector}`);
  const end = css.indexOf("\n  }", start);
  const vars = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z-]+):\s*([\d.]+) ([\d.]+)% ([\d.]+)%/g))
    vars[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return vars;
}
const light = block(":root");
const dark = { ...block(".dark") };
for (const key of Object.keys(light)) if (!(key in dark) && !["radius"].includes(key)) dark[key] = null;

function accentTable() {
  const out = {};
  for (const m of branding.matchAll(/(\w+): \{ label: "[^"]+", color: "([^"]+)", darkColor: "([^"]+)", soft: "([^"]+)", ink: "([^"]+)" \}/g)) {
    const parse = (v) => v.replace(/%/g, "").split(" ").map(Number);
    out[m[1]] = { color: parse(m[2]), dark: parse(m[3]), soft: parse(m[4]), ink: parse(m[5]) };
  }
  return out;
}
const accents = accentTable();
assert.deepEqual(Object.keys(accents), ["forest", "teal", "blue", "violet"]);

const rgb = ([h, s, l]) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => v * 255);
};
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// `fg` drawn at `alpha` over `bg` (for bg-primary/10 style tints)
const over = (fg, bg, alpha) => {
  const f = rgb(fg);
  const b = rgb(bg);
  const mixed = f.map((v, i) => v * alpha + b[i] * (1 - alpha));
  // return as HSL-free pseudo color by encoding through luminance helper
  return { rgb: mixed };
};
const lumRgb = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratioRgb = (a, b) => {
  const [x, y] = [lumRgb(a), lumRgb(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const failures = [];
let checked = 0;
function expect(mode, name, fg, bg, min) {
  checked++;
  const value = ratio(fg, bg);
  if (value < min) failures.push(`${mode}: ${name} = ${value.toFixed(2)}:1 (needs ${min}:1)`);
}
function expectTint(mode, name, fg, tintAlpha, bg, min) {
  checked++;
  const tinted = over(fg, bg, tintAlpha).rgb;
  const value = ratioRgb(rgb(fg), tinted);
  if (value < min) failures.push(`${mode}: ${name} = ${value.toFixed(2)}:1 (needs ${min}:1)`);
}

for (const [mode, t] of [["light", light], ["dark", dark]]) {
  const T = 4.5;
  const U = 3;
  // body text and secondary text on every surface they sit on
  for (const surface of ["background", "card", "muted", "accent"]) {
    expect(mode, `foreground on ${surface}`, t.foreground, t[surface], T);
    expect(mode, `muted-foreground on ${surface}`, t["muted-foreground"], t[surface], T);
  }
  expect(mode, "card-foreground on card", t["card-foreground"], t.card, T);
  expect(mode, "popover-foreground on popover", t["popover-foreground"], t.popover, T);
  // status colors: ink on its soft background, and as text on the page surfaces
  for (const [ink, soft] of [["success", "success-soft"], ["warning", "warning-soft"], ["destructive", "danger-soft"], ["info", "info-soft"], ["request", "request-soft"]]) {
    expect(mode, `${ink} on ${soft}`, t[ink], t[soft], T);
    expect(mode, `${ink} on card`, t[ink], t.card, T);
    expect(mode, `${ink} on background`, t[ink], t.background, T);
  }
  // filled controls
  expect(mode, "destructive-foreground on destructive", t["destructive-foreground"], t.destructive, T);
  // form controls and focus indicators (WCAG 1.4.11)
  expect(mode, "input border on card", t.input, t.card, U);
  expect(mode, "input border on background", t.input, t.background, U);
  // accents
  for (const [name, a] of Object.entries(accents)) {
    const brand = mode === "light" ? a.color : a.dark;
    expect(mode, `primary-foreground on ${name} button`, t["primary-foreground"], brand, T);
    expect(mode, `${name} as text on background`, brand, t.background, T);
    expect(mode, `${name} as text on card`, brand, t.card, T);
    expect(mode, `${name} focus ring on background`, brand, t.background, U);
    expect(mode, `${name} focus ring on card`, brand, t.card, U);
    expectTint(mode, `${name} text on its 10% tint (active nav) over card`, brand, 0.1, t.card, T);
    // Tinted text is only supported on cards and dialogs (white); on the bare page background an
    // icon (3:1) is fine but small text should use the foreground color instead.
    expectTint(mode, `${name} icon on its 10% tint over background`, brand, 0.1, t.background, U);
  }
}
// light-mode tinted accents used by the design (soft background + ink text)
for (const [name, a] of Object.entries(accents)) expect("light", `${name} ink on soft`, a.ink, a.soft, 4.5);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`contrast: ${checked} token pairs pass (text 4.5:1, UI parts 3:1) in light and dark`);
