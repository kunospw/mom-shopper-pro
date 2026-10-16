import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/entitlement.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { planState, canPublish, needsTrialStart, graceEndFromEnv, TRIAL_DAYS } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const DAY = 86_400_000;
const at = new Date("2026-11-10T12:00:00Z");
const iso = (ms) => new Date(at.getTime() + ms).toISOString();
const trial = (startedMsFromNow, paidMsFromNow = null) => ({
  trialStartedAt: iso(startedMsFromNow),
  paidUntil: paidMsFromNow === null ? null : iso(paidMsFromNow),
});
assert.equal(TRIAL_DAYS, 7);

// trial: seven days from the server start, never longer
let state = planState(trial(0), at, null);
assert.deepEqual([state.phase, state.daysLeft, state.active], ["trial", 7, true]);
state = planState(trial(-3 * DAY), at, null);
assert.deepEqual([state.phase, state.daysLeft], ["trial", 4]);
state = planState(trial(-6 * DAY - 23 * 3_600_000), at, null);
assert.deepEqual([state.phase, state.daysLeft], ["trial", 1], "last hours still count as one day");
// boundary: exactly 7 days is already over, matching `request.time < start + 7 days` in the rules
state = planState(trial(-7 * DAY), at, null);
assert.deepEqual([state.phase, state.daysLeft, state.active], ["expired", 0, false]);
state = planState(trial(-7 * DAY + 1), at, null);
assert.equal(state.phase, "trial");

// paid: runs past the trial until paidUntil, then expires
state = planState(trial(-30 * DAY, 10 * DAY), at, null);
assert.deepEqual([state.phase, state.daysLeft, state.active], ["paid", 10, true]);
state = planState(trial(-30 * DAY, -DAY), at, null);
assert.deepEqual([state.phase, state.active], ["expired", false]);
state = planState(trial(-1 * DAY, 20 * DAY), at, null);
assert.equal(state.phase, "paid", "paid access wins during the trial window");

// no entitlement: older shops are open until grace ends, then closed
const grace = new Date(at.getTime() + 20 * DAY);
state = planState(null, at, grace);
assert.deepEqual([state.phase, state.daysLeft, state.active], ["grace", 20, true]);
state = planState(null, at, new Date(at.getTime() - 1));
assert.deepEqual([state.phase, state.active], ["none", false]);
state = planState(null, at, null);
assert.deepEqual([state.phase, state.active], ["none", false]);

// malformed records fail closed
assert.equal(planState({ trialStartedAt: "", paidUntil: null }, at, grace).active, false);
assert.equal(planState({ trialStartedAt: "nonsense", paidUntil: "nope" }, at, grace).phase, "expired");

// publishing: an expired owner cannot reopen a closed shop; an open shop stays editable
const expired = planState(trial(-8 * DAY), at, null);
assert.equal(canPublish(expired, false), false);
assert.equal(canPublish(expired, true), true);
assert.equal(canPublish(planState(null, at, grace), false), true, "no trial yet: publishing starts it");
assert.equal(canPublish(planState(trial(-DAY), at, null), false), true);
assert.equal(needsTrialStart(null, true), true);
assert.equal(needsTrialStart(null, false), false);
assert.equal(needsTrialStart(trial(-DAY), true), false);

// env parsing
assert.equal(graceEndFromEnv(undefined), null);
assert.equal(graceEndFromEnv("garbage"), null);
assert.equal(graceEndFromEnv("2026-12-31T00:00:00Z").toISOString(), "2026-12-31T00:00:00.000Z");
console.log("entitlement: trial, paid, grace, expiry boundary, publish gate, malformed data");
