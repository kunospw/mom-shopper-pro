import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function load(file) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
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
assert.equal(isBusinessLogo("data:image/png;base64," + "A".repeat(140000)), false);
const { summarizeTransactions } = await load("src/lib/transaction-summary.ts");
assert.deepEqual(summarizeTransactions([]), { sales: 0, paid: 0, pending: 0, purchases: 0 });
assert.deepEqual(summarizeTransactions([
  { type: "sale", totalSellingPrice: 100, paymentStatus: "Paid" },
  { type: "sale", sellingPrice: 50, paymentStatus: "Pending" },
  { type: "sale", totalSellingPrice: 0, sellingPrice: 999, paymentStatus: "Paid" },
  { type: "stock", basePrice: 20, quantity: 3, sellingPrice: 999, paymentStatus: "Paid" },
]), { sales: 150, paid: 100, pending: 50, purchases: 60 });
console.log("Branding defaults, logo boundaries, and current/legacy transaction summaries passed.");
