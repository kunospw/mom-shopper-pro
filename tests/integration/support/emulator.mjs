import assert from "node:assert/strict";

/**
 * Helpers for the local Firebase emulators. Everything here talks to
 * 127.0.0.1 and the demo- project only; nothing can reach a real project.
 */
export const PROJECT_ID = "demo-larisku";
assert.ok(PROJECT_ID.startsWith("demo-"));
const FIRESTORE = `http://127.0.0.1:8088/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}`;
// "Bearer owner" is the emulator's admin bypass: reads and writes skip the rules.
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...ADMIN, ...init.headers } });
  if (res.status === 404) return null;
  const body = await res.text();
  assert.ok(res.ok, `${init.method ?? "GET"} ${url}: ${res.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

/** Wipes all Firestore documents and Auth accounts. */
export async function resetEmulators() {
  await call(`http://127.0.0.1:8088/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  await call(`${AUTH}/accounts`, { method: "DELETE" });
}

// --- Firestore REST value encoding -------------------------------------------
const encode = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
};
const decode = (v) => {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields ?? {});
  return v;
};
const decodeFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, decode(x)]));
const toDoc = (d) => ({ id: d.name.split("/").pop(), ...decodeFields(d.fields ?? {}) });

/** Reads one document (rules bypassed), or null. */
export async function getDoc(path) {
  const d = await call(`${FIRESTORE}/${path}`);
  return d ? toDoc(d) : null;
}

/** Lists a collection (rules bypassed). */
export async function listDocs(path) {
  const d = await call(`${FIRESTORE}/${path}?pageSize=300`);
  return (d?.documents ?? []).map(toDoc);
}

/** Merges fields into a document (rules bypassed); used for time travel. */
export async function patchDoc(path, data) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  await call(`${FIRESTORE}/${path}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields: encode(data).mapValue.fields }) });
}

/** Account ids keyed by email. */
export async function accounts() {
  const res = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ returnUserInfo: true }),
  });
  const body = await res.json();
  return Object.fromEntries((body.userInfo ?? []).map((u) => [u.email, u.localId]));
}
