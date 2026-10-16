import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

async function load(file) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
// Modules with relative imports need bundling rather than a single-file transpile.
async function bundle(file) {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(`../${file}`, import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm",
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}
const { getAccent, isBusinessLogo, accents, effectiveAccentKey, LEGACY_ACCENT, NEW_ACCOUNT_ACCENT, PLATFORM_NAME } = await load("src/lib/branding.ts");

// ---- accents: nothing that exists today may change; forest is purely additive ----
assert.deepEqual(
  Object.fromEntries(["teal", "blue", "violet"].map((k) => [k, [accents[k].label, accents[k].color, accents[k].darkColor]])),
  {
    teal: ["Hijau laut", "173 80% 26%", "173 65% 60%"],
    blue: ["Biru", "217 76% 40%", "217 80% 72%"],
    violet: ["Ungu", "262 65% 43%", "262 80% 78%"],
  },
  "existing accents must keep their exact values",
);
assert.deepEqual(Object.keys(accents), ["forest", "teal", "blue", "violet"]);
assert.equal(accents.forest.label, "Hutan");
assert.equal(accents.forest.color, "150 33% 27%"); // #2F5D46
assert.equal(accents.forest.darkColor, "144 25% 60%"); // #7FB394
for (const a of Object.values(accents)) assert(/^\d+ \d+% \d+%$/.test(a.soft) && /^\d+ \d+% \d+%$/.test(a.ink), "soft/ink are HSL triplets");
// records with no stored accent (or an unknown one) render exactly as before: teal
assert.equal(LEGACY_ACCENT, "teal");
for (const legacy of [undefined, "", "pink", "toString", "__proto__"]) {
  assert.equal(effectiveAccentKey(legacy), "teal", String(legacy));
  assert.equal(getAccent(legacy).color, "173 80% 26%", String(legacy));
}
assert.equal(effectiveAccentKey("forest"), "forest");
assert.equal(getAccent("blue").color, "217 76% 40%");
// forest is only ever written for brand-new accounts
assert.equal(NEW_ACCOUNT_ACCENT, "forest");
assert.equal(PLATFORM_NAME, "Mom Shopper Pro");
{
  const auth = await readFile(new URL("../src/contexts/AuthContext.tsx", import.meta.url), "utf8");
  assert(/businessAccent:\s*NEW_ACCOUNT_ACCENT/.test(auth), "new profiles get the platform accent");
  assert.equal((auth.match(/NEW_ACCOUNT_ACCENT/g) || []).length, 2, "only imported and used once (new-profile creation)");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  assert((css.match(/var\(--brand, 173 80% 26%\)/g) || []).length >= 2, "brand fallback stays teal (no color flash for legacy owners)");
  const theme = await readFile(new URL("../src/components/BusinessBrand.tsx", import.meta.url), "utf8");
  assert(/if \(!user\) return;/.test(theme), "signed-out screens keep the accent they set themselves");
}
assert.equal(getAccent().label, "Hijau laut");
assert.equal(getAccent("unknown").label, "Hijau laut");
assert.equal(getAccent("toString").label, "Hijau laut");
assert.equal(getAccent("blue").label, "Biru");
assert.equal(getAccent("violet").label, "Ungu");
assert.equal(isBusinessLogo("https://example.com/logo.png"), false);
assert.equal(isBusinessLogo("data:image/svg+xml;base64,PHN2Zz4="), false);
assert.equal(isBusinessLogo("data:image/png;base64,AAAA"), true);
assert.equal(
  isBusinessLogo("data:image/png;base64," + "A".repeat(140000)),
  false,
);
console.log(
  "Branding defaults and logo boundaries passed.",
);

const { normalizeAppearance, readAppearance, appearanceKey, fontScales } =
  await load("src/lib/appearance.ts");
assert.deepEqual(normalizeAppearance(null), {
  mode: "system",
  fontSize: "standard",
});
assert.deepEqual(
  normalizeAppearance({ mode: "invalid", fontSize: "toString" }),
  { mode: "system", fontSize: "standard" },
);
assert.deepEqual(
  normalizeAppearance({ mode: "dark", fontSize: "extra-large" }),
  { mode: "dark", fontSize: "extra-large" },
);
assert.notEqual(appearanceKey("seller-a"), appearanceKey("seller-b"));
assert.notEqual(appearanceKey(), appearanceKey("seller-a"));
assert.equal(fontScales["extra-large"], "125%");
globalThis.localStorage = { getItem: () => "{broken" };
assert.deepEqual(readAppearance("test"), {
  mode: "system",
  fontSize: "standard",
});
globalThis.localStorage = {
  getItem: () => {
    throw new Error("Storage denied");
  },
};
assert.deepEqual(readAppearance("test"), {
  mode: "system",
  fontSize: "standard",
});
delete globalThis.localStorage;
console.log(
  "Appearance defaults, account isolation, malformed settings, and denied storage passed.",
);

const { workspaceSection } = await load(
  "src/lib/navigation.ts",
);
assert.equal(workspaceSection("/settings/payments").id, "settings");
assert.equal(workspaceSection("/sales").id, "sales");
assert.equal(workspaceSection("/customers/abc").id, "customers");
assert.equal(workspaceSection("/").id, "overview");
const { settingsPatch, settingsChanged, profileFormDefaults } = await bundle(
  "src/lib/settings.ts",
);
// a legacy profile with no stored accent shows teal as selected; an explicit choice is kept
assert.equal(profileFormDefaults({ displayName: "A", bankAccounts: [] }).businessAccent, "teal");
assert.equal(profileFormDefaults({ displayName: "A", businessAccent: "violet", bankAccounts: [] }).businessAccent, "violet");
assert.equal(profileFormDefaults({ displayName: "A", businessAccent: "forest", bankAccounts: [] }).businessAccent, "forest");
const defaults = profileFormDefaults({
  displayName: "Seller",
  businessName: "Toko",
  bankAccounts: [],
});
const draft = {
  ...defaults,
  displayName: "Different person",
  businessName: "New business",
};
assert.deepEqual(settingsPatch("account", draft), {
  displayName: "Different person",
});
assert.equal("displayName" in settingsPatch("business", draft), false);
assert.equal("bankAccounts" in settingsPatch("business", draft), false);
assert.deepEqual(Object.keys(settingsPatch("payments", draft)), [
  "bankAccounts",
]);
assert.equal(settingsChanged("appearance", draft, defaults), false);
assert.equal(settingsChanged("business", draft, defaults), true);
assert.equal(settingsChanged("payments", draft, defaults), false);
console.log(
  "Navigation, filter defaults, section-specific updates, and independent drafts passed.",
);
