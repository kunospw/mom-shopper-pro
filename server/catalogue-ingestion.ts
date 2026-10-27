import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { candidateSchema, extractionSchema, finalProduct, LIMITS, reviewSchema, type JobView } from "../src/lib/catalogue-ingestion";
import { validateUpload } from "./catalogue-adapters";

const jobId = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), after: jobId.optional() }).strict(),
  z.object({ action: z.literal("ingest"), mime: z.enum(["application/pdf", "image/jpeg", "image/png"]), data: z.string().min(4).max(Math.ceil(LIMITS.bytes / 3) * 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }).strict(),
  z.object({ action: z.literal("status"), jobId }).strict(),
  z.object({ action: z.literal("save"), jobId, drafts: reviewSchema }).strict(),
  z.object({ action: z.literal("confirm"), jobId, confirmed: z.literal(true), revision: z.number().int().min(0) }).strict(),
]);
export type Adapters = {
  ocr(bytes: Buffer, mime: string, signal: AbortSignal): Promise<string>;
  extract(text: string, signal: AbortSignal): Promise<unknown>;
};
export type Context = { db: Firestore; verify(token: string): Promise<{ uid: string }>; adapters: Adapters };
class Rejection extends Error { constructor(public code: string, public status = 400) { super(code); } }
const reject = (code: string, status = 400): never => { throw new Rejection(code, status); };
const safeError = (e: unknown) => e instanceof Rejection ? e.code : "processing-failed";
export async function handleCatalogue(body: unknown, authorization: string | null, ctx: Context) {
  let uid: string;
  try {
    if (!authorization?.startsWith("Bearer ")) return { status: 401, body: { error: "sign-in-required" } };
    uid = (await ctx.verify(authorization.slice(7))).uid;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error();
  } catch { return { status: 401, body: { error: "sign-in-required" } }; }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: "invalid-request" } };
  const req = parsed.data;
  const jobs = ctx.db.collection("catalogueIngestions").doc(uid).collection("jobs");
  try {
    if (req.action === "list") {
      let query = jobs.orderBy("__name__").limit(21);
      if (req.after) query = query.startAfter(req.after);
      const result = await query.get();
      return { status: 200, body: { jobs: result.docs.slice(0, 20).map(d => ({ id: d.id, status: d.data().status })), next: result.size > 20 ? result.docs[19].id : null } };
    }
    if (req.action === "ingest") {
      const bytes = Buffer.from(req.data, "base64");
      try { await validateUpload(req.mime, bytes); } catch { return { status: 400, body: { error: "invalid-upload: PDF satu halaman, JPEG/PNG, maksimal 2 MiB dan 16 MP" } }; }
      const hash = createHash("sha256").update(req.mime).update(bytes).digest("hex");
      const ref = jobs.doc(hash);
      const lock = ctx.db.doc("catalogueIngestionLocks/global");
      const quota = ctx.db.doc(`catalogueIngestionLocks/quota_${uid}`);
      const run = randomUUID();
      const now = Date.now();
      const acquired = await ctx.db.runTransaction(async tx => {
        const [snapshot, locks, usage] = await tx.getAll(ref, lock, quota);
        const prior = snapshot.data();
        if (prior?.status === "review" || prior?.status === "confirmed" || (prior?.status === "processing" && prior.expires > now)) return false;
        if ((prior?.attempts ?? 0) >= 3) reject("retry-limit", 429);
        const leases = ((locks.data()?.leases ?? []) as { uid: string; run: string; expires: number }[]).filter(x => x.expires > now);
        if (leases.length >= 2 || leases.some(x => x.uid === uid)) reject("busy-try-later", 429);
        const day = new Date(now).toISOString().slice(0, 10);
        const count = usage.data()?.day === day ? usage.data()!.count : 0;
        if (count >= 20) reject("daily-limit", 429);
        tx.set(quota, { day, count: count + 1 });
        tx.set(lock, { leases: [...leases, { uid, run, expires: now + 60000 }] });
        tx.set(ref, { owner: uid, status: "processing", run, expires: now + 60000, attempts: (prior?.attempts ?? 0) + 1, revision: 0 });
        return true;
      });
      if (acquired) {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const extraction = async () => {
            const text = await ctx.adapters.ocr(bytes, req.mime, controller.signal);
            if (!text.trim() || text.length > LIMITS.text) reject("ocr-empty-or-text-limit");
            return extractionSchema.parse(await ctx.adapters.extract(text, controller.signal));
          };
          const result = await Promise.race([extraction(), new Promise<never>((_, fail) => {
            timer = setTimeout(() => { controller.abort(); fail(new Rejection("processing-timeout", 408)); }, LIMITS.processingMs);
          })]);
          await ctx.db.runTransaction(async tx => {
            const snapshot = await tx.get(ref);
            if (snapshot.data()?.run !== run) reject("stale-attempt", 409);
            const ids = result.products.map((_, i) => String(i).padStart(2, "0"));
            result.products.forEach((candidate, i) => tx.create(ref.collection("drafts").doc(ids[i]), { owner: uid, candidate, status: "review" }));
            tx.update(ref, { status: "review", draftIds: ids, elapsedMs: Date.now() - now });
          });
        } catch (e) {
          await ctx.db.runTransaction(async tx => {
            const current = await tx.get(ref);
            if (current.data()?.run === run) tx.update(ref, { status: "failed", error: safeError(e), elapsedMs: Date.now() - now });
          });
        } finally {
          clearTimeout(timer);
          controller.abort();
          await ctx.db.runTransaction(async tx => {
            const current = await tx.get(lock);
            tx.set(lock, { leases: (current.data()?.leases ?? []).filter((x: { run: string }) => x.run !== run) });
          });
        }
      }
      return { status: 200, body: await view(hash) };
    }
    const ref = jobs.doc(req.jobId);
    if (req.action === "status") return { status: 200, body: await view(req.jobId) };
    if (req.action === "save") {
      await ctx.db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const job = snapshot.data();
        if (!job || job.owner !== uid) return reject("not-found", 404);
        if (job.status !== "review") reject("not-reviewable", 409);
        if (JSON.stringify([...job.draftIds].sort()) !== JSON.stringify(req.drafts.map(x => x.id).sort())) reject("draft-set-mismatch");
        const docs = await tx.getAll(...req.drafts.map(x => ref.collection("drafts").doc(x.id)));
        docs.forEach(d => { if (d.data()?.owner !== uid || d.data()?.status !== "review") reject("invalid-draft", 409); });
        req.drafts.forEach(d => tx.update(ref.collection("drafts").doc(d.id), { candidate: candidateSchema.parse(d.candidate) }));
        tx.update(ref, { revision: job.revision + 1 });
      });
      return { status: 200, body: await view(req.jobId) };
    }
    await ctx.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      const job = snapshot.data();
      if (!job || job.owner !== uid) return reject("not-found", 404);
      if (job.status === "confirmed") return; // durable receipt, even when products were later edited/deleted
      if (job.status !== "review" || job.revision !== req.revision) reject("review-changed-reload", 409);
      const ids = z.array(z.string().regex(/^\d{2}$/)).min(1).max(LIMITS.products).parse(job.draftIds);
      if (new Set(ids).size !== ids.length) reject("invalid-draft-set");
      const docs = await tx.getAll(...ids.map(id => ref.collection("drafts").doc(id)));
      const products = docs.map(d => {
        if (d.data()?.owner !== uid || d.data()?.status !== "review") reject("invalid-draft", 409);
        try { return finalProduct(d.data()?.candidate); } catch { return reject("missing-or-invalid-fields"); }
      });
      const productIds = ids.map(id => `ingest_${req.jobId}_${id}`);
      // create() preconditions ensure existing products can NEVER be overwritten.
      products.forEach((product, i) => {
        tx.create(ctx.db.doc(`storefronts/${uid}/products/${productIds[i]}`), { ...product, updatedAt: FieldValue.serverTimestamp() });
        tx.update(docs[i].ref, { status: "confirmed", productId: productIds[i] });
      });
      tx.update(ref, { status: "confirmed", productIds });
    });
    return { status: 200, body: await view(req.jobId) };
  } catch (e) { return { status: e instanceof Rejection ? e.status : 503, body: { error: e instanceof Rejection ? e.code : "unavailable" } }; }

  async function view(id: string): Promise<JobView & { revision: number }> {
    const snapshot = await jobs.doc(id).get();
    const job = snapshot.data();
    if (!job || job.owner !== uid) return reject("not-found", 404);
    const drafts = job.status === "review" ? (await snapshot.ref.collection("drafts").get()).docs.map(d => ({ id: d.id, candidate: candidateSchema.parse(d.data().candidate) })) : [];
    return { id, status: job.status === "processing" && job.expires < Date.now() ? "failed" : job.status, revision: job.revision,
      drafts, ...(job.error ? { error: job.error } : {}), ...(job.elapsedMs != null ? { elapsedMs: job.elapsedMs } : {}), ...(job.productIds ? { productIds: job.productIds } : {}) };
  }
}
