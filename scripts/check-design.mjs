import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

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
const { getAccent, isBusinessLogo } = await load("src/lib/branding.ts");
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
const { summarizeTransactions } = await load("src/lib/transaction-summary.ts");
assert.deepEqual(summarizeTransactions([]), {
  sales: 0,
  paid: 0,
  pending: 0,
  purchases: 0,
});
assert.deepEqual(
  summarizeTransactions([
    { type: "sale", totalSellingPrice: 100, paymentStatus: "Paid" },
    { type: "sale", sellingPrice: 50, paymentStatus: "Pending" },
    {
      type: "sale",
      totalSellingPrice: 0,
      sellingPrice: 999,
      paymentStatus: "Paid",
    },
    {
      type: "stock",
      basePrice: 20,
      quantity: 3,
      sellingPrice: 999,
      paymentStatus: "Paid",
    },
  ]),
  { sales: 150, paid: 100, pending: 50, purchases: 60 },
);
console.log(
  "Branding defaults, logo boundaries, and current/legacy transaction summaries passed.",
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

const { workspaceSection, transactionFilters } = await load(
  "src/lib/navigation.ts",
);
assert.equal(workspaceSection("/settings/payments").id, "settings");
assert.equal(workspaceSection("/transactions").id, "transactions");
assert.equal(workspaceSection("/").id, "overview");
assert.deepEqual(
  transactionFilters(new URLSearchParams("status=bad&type=bad&month=2026-99")),
  { status: "all", type: "all", month: "all", q: "" },
);
assert.deepEqual(
  transactionFilters(
    new URLSearchParams("status=Pending&type=sale&month=2026-10&q=Siti"),
  ),
  { status: "Pending", type: "sale", month: "2026-10", q: "Siti" },
);
const { settingsPatch, settingsChanged, profileFormDefaults } = await load(
  "src/lib/settings.ts",
);
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
