#!/usr/bin/env node
/**
 * Lists (and optionally creates) entitlements for shops that were already open
 * before the subscription rules existed. See docs/subscription.md.
 *
 * DRY RUN BY DEFAULT: with no flags this only reads and prints. Writing requires
 *   --apply  --project <firebase project id>  and GOOGLE_APPLICATION_CREDENTIALS
 * pointing at a service account for that project. Run it only against the project
 * you intend to change, after reviewing the dry-run list.
 *
 *   node scripts/backfill-entitlements.mjs --project my-project            # dry run
 *   node scripts/backfill-entitlements.mjs --project my-project --apply    # start 7-day trials
 *   node scripts/backfill-entitlements.mjs --project my-project --apply --paid-until 2027-01-31T00:00:00Z
 *
 * `firebase-admin` is not an app dependency; install it somewhere outside the repo
 * (for example `npm install --prefix "$(mktemp -d)" firebase-admin`) and set
 * NODE_PATH to that node_modules directory.
 */
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const apply = flag("apply");
const project = value("project");
const paidUntil = value("paid-until");
if (paidUntil && Number.isNaN(Date.parse(paidUntil))) {
  console.error(`--paid-until "${paidUntil}" is not a valid date.`);
  process.exit(2);
}
if (!project) {
  console.error("Pass --project <firebase project id> so the target is explicit.");
  process.exit(2);
}
if (apply && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("--apply needs GOOGLE_APPLICATION_CREDENTIALS (a service account for the project). Nothing was changed.");
  process.exit(2);
}
if (process.env.FIRESTORE_EMULATOR_HOST) console.log(`Using the Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}.`);

let admin;
try {
  admin = createRequire(`${process.cwd()}/`)("firebase-admin");
} catch {
  console.error("firebase-admin is not installed. See the header of this script for how to provide it. Nothing was changed.");
  process.exit(2);
}
admin.initializeApp({ projectId: project });
const db = admin.firestore();

const open = await db.collection("storefronts").where("published", "==", true).get();
const missing = [];
for (const shop of open.docs) {
  const entitlement = await db.doc(`entitlements/${shop.id}`).get();
  if (!entitlement.exists) missing.push({ id: shop.id, name: shop.get("name") || "(tanpa nama)" });
}
console.log(`${open.size} open shops, ${missing.length} without an entitlement.`);
for (const shop of missing) console.log(`  ${shop.id}  ${shop.name}`);

if (!apply) {
  console.log("\nDry run: nothing was written. Re-run with --apply to create entitlements.");
  process.exit(0);
}
const now = admin.firestore.FieldValue.serverTimestamp();
for (const shop of missing) {
  await db.doc(`entitlements/${shop.id}`).create({
    trialStartedAt: now,
    paidUntil: paidUntil ? admin.firestore.Timestamp.fromDate(new Date(paidUntil)) : null,
  });
  console.log(`created entitlement for ${shop.id}`);
}
console.log(`Done: ${missing.length} entitlements created.`);
