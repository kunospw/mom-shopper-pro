import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

// Render the shared status components to static markup and check that every
// status says what it is in text, with a non-color cue (icon or dot shape).
const dir = fileURLToPath(new URL("../node_modules/.cache/check-status/", import.meta.url));
await mkdir(dir, { recursive: true });
const file = `${dir}status.test.cjs`;
await build({
  stdin: {
    contents: `
      import * as React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      export * from "@/components/status";
      export { React, renderToStaticMarkup };
    `,
    resolveDir: fileURLToPath(new URL("..", import.meta.url)),
    loader: "tsx",
  },
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile: file,
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  logLevel: "silent",
});
const mod = createRequire(import.meta.url)(file);
const { React, renderToStaticMarkup } = mod;
const html = (el) => renderToStaticMarkup(el);
const h = React.createElement;

// payment: text label + dot shape per state, decorative dot hidden from AT
const payments = { unpaid: ["Belum bayar", "bg-transparent"], partial: ["DP / sebagian", "linear-gradient"], paid: ["Lunas", "bg-current"] };
for (const [state, [label, dot]] of Object.entries(payments)) {
  const s = html(h(mod.PaymentChip, { state }));
  assert(s.includes(label), state);
  assert(s.includes(dot), `${state} dot shape`);
  assert(s.includes('aria-hidden="true"'), `${state} dot is decorative`);
}
const refund = html(h(mod.PaymentChip, { state: "refund-due" }));
assert(refund.includes("Perlu dikembalikan") && refund.includes("<svg"), "refund-due has text + icon");

// fulfillment: every status has an icon and its label; cancelled is struck through
for (const [status, label] of Object.entries({ confirmed: "Dikonfirmasi", packed: "Dikemas", shipped: "Dikirim", delivered: "Terkirim (digital)", done: "Selesai", cancelled: "Dibatalkan" })) {
  const s = html(h(mod.FulfillmentChip, { status }));
  assert(s.includes(label) && s.includes("<svg") && s.includes('aria-hidden="true"'), status);
}
assert(html(h(mod.FulfillmentChip, { status: "cancelled" })).includes("line-through"));

// request status
for (const [status, label] of Object.entries({ pending: "Menunggu konfirmasi", confirmed: "Dikonfirmasi", rejected: "Ditolak" })) {
  const s = html(h(mod.RequestChip, { status }));
  assert(s.includes(label) && s.includes("<svg"), status);
}
const ticket = html(h(mod.RequestTicket, { code: "K7Q2MD", title: "Ayu Lestari", meta: "3 item", amount: "Rp 263.000" }));
assert(ticket.includes("Permintaan #K7Q2MD") && ticket.includes("border-dashed") && ticket.includes("Rp 263.000"));

// code badge: plain vs copyable (button has an accessible name, live region present)
assert(!html(h(mod.CodeBadge, { code: "K7Q2MD" })).includes("<button"));
const copy = html(h(mod.CodeBadge, { code: "K7Q2MD", copyable: true }));
assert(copy.includes("<button") && copy.includes('aria-label="Salin kode #K7Q2MD"') && copy.includes('role="status"'));

// paid bar: a real progressbar with a text value, clamped
const bar = html(h(mod.PaidBar, { paid: 150000, total: 263000 }));
assert(bar.includes('role="progressbar"') && bar.includes('aria-valuenow="57"') && bar.includes("57% dibayar"));
assert(html(h(mod.PaidBar, { paid: 5, total: 0 })).includes('aria-valuenow="0"'));
assert(html(h(mod.PaidBar, { paid: 999, total: 100 })).includes('aria-valuenow="100"'));
console.log("status components: text + non-color cue, accessible names, clamped progress");
