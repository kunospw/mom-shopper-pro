import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { db, account, context, call, candidate, projectId, firestorePort } from "./ingestion-context.mjs";
const requireTool = createRequire(`${process.env.CATALOG_TEST_TOOLING}/package.json`);
const { initializeTestEnvironment, assertFails, assertSucceeds } = requireTool("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, getDocs, collection, updateDoc, deleteDoc } = requireTool("firebase/firestore");
const env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: firestorePort, rules: await readFile("firebase/firestore.rules", "utf8") } });
const user = await account(), other = await account();
const png = (await readFile("tests/e2e/fixtures/photo.png")).toString("base64");
const upload = { action: "ingest", mime: "image/png", data: png };
const products = db.collection(`storefronts/${user.uid}/products`);
try {
  await env.clearFirestore();
  assert.equal((await call(null, upload)).status, 401);
  assert.equal((await call(null, { action: "list" })).status, 401);
  assert.equal((await call({ token: "forged" }, upload)).status, 401);
  assert.equal((await call(user, { ...upload, uid: other.uid })).status, 400);
  const start = performance.now();
  const result = await call(user, upload);
  assert.equal(result.status, 200); assert.equal(result.body.status, "review");
  console.log(`Mocked one-page PNG upload to persisted review: ${Math.round(performance.now() - start)}ms. NOT real OCR latency.`);
  const id = result.body.id, root = `catalogueIngestions/${user.uid}/jobs/${id}`;
  assert.equal((await products.get()).size, 0);
  assert.equal((await call(user, upload)).body.id, id);
  assert.equal((await db.collection(`${root}/drafts`).get()).size, 2);
  assert.equal((await call(other, { action: "status", jobId: id })).status, 404);
  assert.equal((await call(other, { action: "list" })).body.jobs.length, 0);
  assert.equal((await call(user, { action: "list" })).body.jobs[0].id, id);
  assert.equal((await call(other, { action: "save", jobId: id, drafts: result.body.drafts })).status, 404);
  assert.equal((await call(other, { action: "confirm", jobId: id, confirmed: true, revision: 0 })).status, 404);
  const owner = env.authenticatedContext(user.uid).firestore(), stranger = env.authenticatedContext(other.uid).firestore(), anonymous = env.unauthenticatedContext().firestore();
  for (const client of [owner, stranger, anonymous]) {
    await assertFails(setDoc(doc(client, `${root}/drafts/injected`), { owner: user.uid, candidate }));
    await assertFails(setDoc(doc(client, root), { owner: user.uid, status: "confirmed" }));
    await assertFails(updateDoc(doc(client, `${root}/drafts/00`), { "candidate.price": 1 }));
    await assertFails(deleteDoc(doc(client, `${root}/drafts/00`)));
    await assertFails(getDoc(doc(client, "catalogueIngestionLocks/global")));
  }
  await assertSucceeds(getDoc(doc(owner, `${root}/drafts/00`)));
  await assertSucceeds(getDocs(collection(owner, `${root}/drafts`)));
  for (const client of [stranger, anonymous]) {
    await assertFails(getDoc(doc(client, root)));
    await assertFails(getDoc(doc(client, `${root}/drafts/00`)));
    await assertFails(getDocs(collection(client, `${root}/drafts`)));
  }
  assert.equal((await call(user, { action: "confirm", jobId: id, revision: 0 })).status, 400);
  assert.equal((await call(user, { action: "confirm", jobId: id, confirmed: true, revision: 0 })).status, 400);
  assert.equal((await products.get()).size, 0, "one missing field aborts all products");
  assert.equal((await db.doc(root).get()).data().status, "review");
  const corrected = result.body.drafts.map(d => ({ ...d, candidate: { ...d.candidate, price: 150000 } }));
  assert.equal((await call(user, { action: "save", jobId: id, drafts: corrected.map(d => ({ ...d, candidate: { ...d.candidate, published: true } })) })).status, 400);
  const saved = await call(user, { action: "save", jobId: id, drafts: corrected });
  assert.equal(saved.body.revision, 1);
  assert.equal((await call(user, { action: "confirm", jobId: id, confirmed: true, revision: 0 })).status, 409);
  // Admin corruption bypasses rules, but backend validation independently blocks it.
  await db.doc(`${root}/drafts/01`).update({ candidate: { ...candidate, price: -1 } });
  assert.equal((await call(user, { action: "confirm", jobId: id, confirmed: true, revision: 1 })).status, 400);
  assert.equal((await products.get()).size, 0);
  const saved2 = await call(user, { action: "save", jobId: id, drafts: corrected });
  const confirm = { action: "confirm", jobId: id, confirmed: true, revision: saved2.body.revision };
  // Collision must not overwrite existing product or partially commit the other one.
  await products.doc(`ingest_${id}_01`).set({ sentinel: true });
  assert.equal((await call(user, confirm)).status, 503);
  assert.equal((await products.get()).size, 1);
  assert.equal((await db.doc(root).get()).data().status, "review");
  await products.doc(`ingest_${id}_01`).delete();
  const outcomes = await Promise.all([call(user, confirm), call(user, confirm)]);
  assert.ok(outcomes.every(r => r.status === 200 && r.body.status === "confirmed"));
  assert.equal((await products.get()).size, 2);
  assert.deepEqual(outcomes[0].body.productIds, outcomes[1].body.productIds);
  for (const d of (await products.get()).docs) { assert.equal(d.data().published, false); assert.equal(d.data().price, 150000); }
  assert.equal((await db.doc(`${root}/drafts/00`).get()).data().status, "confirmed");
  assert.equal((await call(user, confirm)).body.status, "confirmed");
  assert.equal((await call(user, upload)).body.status, "confirmed");
  const realVersion = await call(user, upload, { ...context, pipeline: "real-test-v1" });
  assert.notEqual(realVersion.body.id, id, "real extraction never reuses a legacy mock receipt");
  assert.equal(realVersion.body.pipeline, "real-test-v1");
  assert.equal(realVersion.body.status, "review");
  assert.equal((await products.get()).size, 2, "new pipeline still requires explicit confirmation");
  assert.equal((await call(user, upload, { ...context, pipeline: "real-test-v1" })).body.id, realVersion.body.id);
  // Malformed extraction persists an explicit failed job, never products.
  const failedUser = await account();
  for (const output of [{ complete: true, products: [{ ...candidate, uid: "evil" }] }, { complete: false, products: [] }]) {
    const failed = await call(failedUser, upload, { ...context, adapters: { ...context.adapters, extract: async () => output } });
    assert.equal(failed.body.status, "failed");
    assert.equal((await db.collection(`storefronts/${failedUser.uid}/products`).get()).size, 0);
  }
  const recovery = await call(failedUser, upload);
  assert.equal(recovery.body.status, "review");
  const limited = await account();
  await db.doc(`catalogueIngestionLocks/quota_${limited.uid}`).set({ day: new Date().toISOString().slice(0, 10), count: 20 });
  assert.equal((await call(limited, upload)).body.error, "daily-limit");
  await db.doc("catalogueIngestionLocks/global").set({ leases: [{ uid: limited.uid, run: "owner-slot", expires: Date.now() + 60000 }] });
  assert.equal((await call(limited, upload)).body.error, "busy-try-later");
  await db.doc("catalogueIngestionLocks/global").delete();
  const retryUser = await account();
  const broken = { ...context, adapters: { ...context.adapters, extract: async () => ({ complete: false, products: [] }) } };
  for (let i = 0; i < 3; i++) assert.equal((await call(retryUser, upload, broken)).body.status, "failed");
  assert.equal((await call(retryUser, upload, broken)).body.error, "retry-limit");
  // Global slots and per-owner slots are enforced by Firestore transactions.
  await db.doc("catalogueIngestionLocks/global").set({ leases: [ { uid: "x", run: "a", expires: Date.now() + 60000 }, { uid: "y", run: "b", expires: Date.now() + 60000 } ] });
  assert.equal((await call(await account(), upload)).status, 429);
  console.log("PASS ingestion emulator: real token verification, owner isolation, client creation/edit denial, mocked OCR pipeline, correction, independent Admin validation, atomic failure/success/concurrent repeats and duplicate upload.");
} finally { await db.doc("catalogueIngestionLocks/global").delete(); await env.cleanup(); }
