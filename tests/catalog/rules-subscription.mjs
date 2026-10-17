import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
// Trial, plan and public-tracking rules. Time travel is done by substituting the grace
// constant in the rules text and by seeding entitlements with past timestamps.
const dependencyRoot = process.env.CATALOG_TEST_TOOLING;
if (!dependencyRoot || !process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error("Use isolated tooling and a Firestore emulator; never production.");
const requireTool = createRequire(`${dependencyRoot}/package.json`);
const { initializeTestEnvironment, assertSucceeds, assertFails } = requireTool("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } = requireTool("firebase/firestore");
const source = await readFile(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
const GRACE = "timestamp.date(2026, 12, 31)";
assert(source.includes(GRACE), "grace placeholder missing from rules");

const DAY = 86_400_000;
const ago = (ms) => Timestamp.fromDate(new Date(Date.now() - ms));
const ahead = (ms) => Timestamp.fromDate(new Date(Date.now() + ms));
const shopFields = (over = {}) => ({
  name: "Toko A", description: "", whatsapp: "6281234567890", accent: "teal", logo: "",
  published: true, slug: "", updatedAt: serverTimestamp(), ...over,
});
const productFields = {
  name: "Kemeja", description: "", category: "", price: 150000, image: "", availability: "ready",
  leadTime: "", optionLabel: "Pilihan", options: [], kind: "physical", published: true, updatedAt: serverTimestamp(),
};
const item = {
  productId: "p1", name: "Kemeja", option: "", kind: "physical", unitPrice: 150000, quantity: 1,
  availability: "ready", leadTime: "",
};
const orderFields = (storeName = "Toko A") => ({
  status: "pending", progress: "pending", buyerName: "Siti", note: "", items: [item], subtotal: 150000,
  trackingNo: "", sellerNote: "", shop: { name: storeName, whatsapp: "6281234567890", slug: "" }, steps: {},
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
const trialDoc = () => ({ trialStartedAt: serverTimestamp(), paidUntil: null });

async function suite(label, graceEnd) {
  const rules = source.replace(GRACE, graceEnd);
  const env = await initializeTestEnvironment({ projectId: `demo-sub-${label}`, firestore: { rules } });
  await env.clearFirestore();
  const cache = new Map();
  const as = (uid) => {
    if (!cache.has(uid)) cache.set(uid, env.authenticatedContext(uid).firestore());
    return cache.get(uid);
  };
  const buyer = env.unauthenticatedContext().firestore();
  const seed = (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
  // A shop as an older deployment would have left it: published, no entitlement.
  const seedShop = (uid, { published = true, ent = null, order = true } = {}) =>
    seed(async (db) => {
      await setDoc(doc(db, `storefronts/${uid}`), shopFields({ published }));
      await setDoc(doc(db, `storefronts/${uid}/products/p1`), productFields);
      if (ent) await setDoc(doc(db, `entitlements/${uid}`), ent);
      if (order) await setDoc(doc(db, `storefronts/${uid}/orders/o1`), { ...orderFields(), createdAt: ago(DAY), updatedAt: ago(DAY) });
    });
  const openBatch = (db, uid, over = {}) => {
    const batch = writeBatch(db);
    batch.set(doc(db, `storefronts/${uid}`), shopFields(over));
    batch.set(doc(db, `entitlements/${uid}`), trialDoc());
    return batch;
  };
  const name = (text) => `${label}: ${text}`;
  const results = [];
  const check = async (text, fn) => {
    try {
      await fn();
      results.push(name(text));
    } catch (error) {
      console.error(`FAIL ${name(text)}`);
      throw error;
    }
  };
  const graceOpen = label === "grace";

  // ---- new accounts can never bypass the trial ----
  await check("new account cannot publish without the trial", async () => {
    await assertFails(setDoc(doc(as("n1"), "storefronts/n1"), shopFields()));
  });
  await check("unpublished shop can be created, but not flipped open without the trial", async () => {
    await assertSucceeds(setDoc(doc(as("n2"), "storefronts/n2"), shopFields({ published: false })));
    await assertFails(setDoc(doc(as("n2"), "storefronts/n2"), shopFields()));
    await assertFails(updateDoc(doc(as("n2"), "storefronts/n2"), { published: true, updatedAt: serverTimestamp() }));
  });
  await check("opening the shop and starting the trial in one batch works", async () => {
    await assertSucceeds(openBatch(as("n2"), "n2").commit());
    await assertSucceeds(getDoc(doc(buyer, "storefronts/n2")));
  });
  await check("a trial cannot start for a shop that is not published", async () => {
    await assertSucceeds(setDoc(doc(as("n3"), "storefronts/n3"), shopFields({ published: false })));
    await assertFails(setDoc(doc(as("n3"), "entitlements/n3"), trialDoc()));
    const batch = writeBatch(as("n3"));
    batch.set(doc(as("n3"), "storefronts/n3"), shopFields({ published: false }));
    batch.set(doc(as("n3"), "entitlements/n3"), trialDoc());
    await assertFails(batch.commit());
  });
  await check("entitlement tampering is refused", async () => {
    for (const [id, data] of Object.entries({
      t1: { trialStartedAt: ahead(30 * DAY), paidUntil: null },
      t2: { trialStartedAt: ago(30 * DAY), paidUntil: null },
      t3: { trialStartedAt: serverTimestamp(), paidUntil: ahead(365 * DAY) },
      t4: { trialStartedAt: serverTimestamp(), paidUntil: null, plan: "pro" },
      t5: { trialStartedAt: serverTimestamp() },
      t6: { paidUntil: null },
    })) {
      const batch = writeBatch(as(id));
      batch.set(doc(as(id), `storefronts/${id}`), shopFields());
      batch.set(doc(as(id), `entitlements/${id}`), data);
      await assertFails(batch.commit());
    }
    // someone else's entitlement, even for a published shop of theirs
    await assertFails(setDoc(doc(as("n1"), "entitlements/n2"), trialDoc()));
  });
  await check("entitlement cannot be edited, replaced or deleted by its owner", async () => {
    await assertFails(updateDoc(doc(as("n2"), "entitlements/n2"), { paidUntil: ahead(365 * DAY) }));
    await assertFails(setDoc(doc(as("n2"), "entitlements/n2"), trialDoc()));
    await assertFails(deleteDoc(doc(as("n2"), "entitlements/n2")));
    await assertSucceeds(getDoc(doc(as("n2"), "entitlements/n2")));
    await assertFails(getDoc(doc(as("n1"), "entitlements/n2")));
    await assertFails(getDoc(doc(buyer, "entitlements/n2")));
  });

  // ---- older shops: open only during the grace period ----
  await check("older shop: public products and new orders follow the grace period", async () => {
    await seedShop("l1");
    const product = getDoc(doc(buyer, "storefronts/l1/products/p1"));
    const created = setDoc(doc(buyer, "storefronts/l1/orders/new1"), orderFields());
    if (graceOpen) {
      await assertSucceeds(product);
      await assertSucceeds(created);
    } else {
      await assertFails(product);
      await assertFails(created);
    }
  });
  await check("older shop: the owner can keep editing it and reading orders either way", async () => {
    await assertSucceeds(setDoc(doc(as("l1"), "storefronts/l1"), shopFields({ description: "baru" })));
    await assertSucceeds(getDoc(doc(buyer, "storefronts/l1/orders/o1")));
  });
  await check("older shop: closing then reopening needs the trial", async () => {
    await assertSucceeds(setDoc(doc(as("l1"), "storefronts/l1"), shopFields({ published: false })));
    await assertFails(setDoc(doc(as("l1"), "storefronts/l1"), shopFields()));
    await assertSucceeds(openBatch(as("l1"), "l1").commit());
    await assertSucceeds(getDoc(doc(buyer, "storefronts/l1/products/p1")));
  });
  await check("older shop: the owner can start the trial without editing the shop", async () => {
    await seedShop("l2");
    await assertSucceeds(setDoc(doc(as("l2"), "entitlements/l2"), trialDoc()));
    await assertSucceeds(getDoc(doc(buyer, "storefronts/l2/products/p1")));
  });

  // ---- expired trial ----
  await check("expired trial: catalog and new orders close, existing orders keep working", async () => {
    await seedShop("e1", { ent: { trialStartedAt: ago(8 * DAY), paidUntil: null } });
    await assertFails(getDoc(doc(buyer, "storefronts/e1/products/p1")));
    await assertFails(setDoc(doc(buyer, "storefronts/e1/orders/new"), orderFields()));
    const snapshot = await assertSucceeds(getDoc(doc(buyer, "storefronts/e1/orders/o1")));
    assert.equal(snapshot.data().shop.name, "Toko A");
    await assertSucceeds(getDoc(doc(as("e1"), "storefronts/e1/products/p1")));
    await assertSucceeds(
      updateDoc(doc(as("e1"), "storefronts/e1/orders/o1"), {
        status: "confirmed", progress: "confirmed", "steps.confirmed": serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(setDoc(doc(as("e1"), "users/e1/sales/s1"), { total: 1 }));
  });
  await check("expired trial: cannot reopen, cannot restart the trial", async () => {
    await assertSucceeds(setDoc(doc(as("e1"), "storefronts/e1"), shopFields({ published: false })));
    await assertFails(setDoc(doc(as("e1"), "storefronts/e1"), shopFields()));
    await assertFails(openBatch(as("e1"), "e1").commit());
    await assertFails(setDoc(doc(as("e1"), "entitlements/e1"), trialDoc()));
  });
  await check("trial boundary is seven days", async () => {
    await seedShop("b1", { ent: { trialStartedAt: ago(7 * DAY - 120_000), paidUntil: null }, order: false });
    await seedShop("b2", { ent: { trialStartedAt: ago(7 * DAY + 120_000), paidUntil: null }, order: false });
    await assertSucceeds(getDoc(doc(buyer, "storefronts/b1/products/p1")));
    await assertFails(getDoc(doc(buyer, "storefronts/b2/products/p1")));
  });

  // ---- paid plan ----
  await check("paid plan keeps the shop open past the trial until paidUntil", async () => {
    await seedShop("p1", { ent: { trialStartedAt: ago(40 * DAY), paidUntil: ahead(10 * DAY) }, order: false });
    await seedShop("p2", { ent: { trialStartedAt: ago(40 * DAY), paidUntil: ago(DAY) }, order: false });
    await assertSucceeds(getDoc(doc(buyer, "storefronts/p1/products/p1")));
    await assertSucceeds(setDoc(doc(buyer, "storefronts/p1/orders/new"), orderFields()));
    await assertFails(getDoc(doc(buyer, "storefronts/p2/products/p1")));
    await assertFails(setDoc(doc(buyer, "storefronts/p2/orders/new"), orderFields()));
  });

  // ---- manual unpublish never strands buyers ----
  await check("manual unpublish: tracking, owner updates and bookkeeping keep working", async () => {
    await seedShop("u1", { ent: { trialStartedAt: ago(DAY), paidUntil: null } });
    await assertSucceeds(setDoc(doc(as("u1"), "storefronts/u1"), shopFields({ published: false })));
    await assertFails(getDoc(doc(buyer, "storefronts/u1")));
    await assertFails(getDoc(doc(buyer, "storefronts/u1/products/p1")));
    await assertFails(setDoc(doc(buyer, "storefronts/u1/orders/new"), orderFields()));
    const snapshot = await assertSucceeds(getDoc(doc(buyer, "storefronts/u1/orders/o1")));
    assert.deepEqual(snapshot.data().shop, { name: "Toko A", whatsapp: "6281234567890", slug: "" });
    await assertSucceeds(
      updateDoc(doc(as("u1"), "storefronts/u1/orders/o1"), {
        progress: "shipped", trackingNo: "JNE1", "steps.shipped": serverTimestamp(), updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(setDoc(doc(as("u1"), "users/u1/sales/s1"), { total: 1 }));
  });
  await check("manual unpublish then reopen within the trial works", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "storefronts/u1"), shopFields()));
    await assertSucceeds(getDoc(doc(buyer, "storefronts/u1/products/p1")));
  });

  // ---- order snapshot and progress timestamps ----
  await check("orders must carry the real shop snapshot", async () => {
    await seedShop("s1", { ent: { trialStartedAt: ago(DAY), paidUntil: null }, order: false });
    await assertSucceeds(setDoc(doc(buyer, "storefronts/s1/orders/ok"), orderFields()));
    await assertFails(setDoc(doc(buyer, "storefronts/s1/orders/lie"), orderFields("Toko Palsu")));
  });
  await check("progress timestamps: only the stage being set, with server time", async () => {
    const order = doc(as("s1"), "storefronts/s1/orders/ok");
    const base = { updatedAt: serverTimestamp() };
    await assertFails(updateDoc(order, { ...base, progress: "confirmed", status: "confirmed", "steps.shipped": serverTimestamp() }));
    await assertFails(updateDoc(order, { ...base, progress: "confirmed", status: "confirmed", "steps.confirmed": new Date("2020-01-01") }));
    await assertFails(updateDoc(order, { ...base, progress: "confirmed", status: "confirmed", "steps.confirmed": "yesterday" }));
    await assertFails(updateDoc(order, { ...base, progress: "confirmed", status: "confirmed", steps: { confirmed: serverTimestamp(), packed: serverTimestamp() } }));
    await assertSucceeds(updateDoc(order, { ...base, progress: "confirmed", status: "confirmed", "steps.confirmed": serverTimestamp() }));
    await assertSucceeds(updateDoc(order, { ...base, progress: "packed", "steps.packed": serverTimestamp() }));
    // an earlier stage cannot be rewritten while moving on
    await assertFails(updateDoc(order, { ...base, progress: "shipped", "steps.confirmed": serverTimestamp() }));
    const data = (await getDoc(doc(buyer, "storefronts/s1/orders/ok"))).data();
    assert.deepEqual(Object.keys(data.steps).sort(), ["confirmed", "packed"]);
  });
  await check("orders from before the snapshot stay readable and updatable", async () => {
    await seed(async (db) =>
      setDoc(doc(db, "storefronts/s1/orders/old"), {
        status: "pending", progress: "pending", buyerName: "Lama", note: "", items: [item], subtotal: 150000,
        trackingNo: "", sellerNote: "", createdAt: ago(DAY), updatedAt: ago(DAY),
      }),
    );
    await assertSucceeds(getDoc(doc(buyer, "storefronts/s1/orders/old")));
    await assertSucceeds(updateDoc(doc(as("s1"), "storefronts/s1/orders/old"), { status: "confirmed", progress: "confirmed", "steps.confirmed": serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as("s1"), "storefronts/s1/orders/old"), { sellerNote: "ok", updatedAt: serverTimestamp() }));
  });
  await env.cleanup();
  return results;
}

const all = [...(await suite("grace", "timestamp.date(2999, 1, 1)")), ...(await suite("closed", "timestamp.date(2000, 1, 1)"))];
console.log(`PASS: ${all.length} subscription rule checks (trial gate, grace, expiry, paid, unpublish, tracking snapshot, steps).`);
