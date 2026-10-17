# Plan, trial and order tracking

This describes what the app and `firebase/firestore.rules` enforce. Nothing here is deployed automatically.

## What a plan controls

| Needs an active trial or plan | Never gated |
| --- | --- |
| Buyers seeing products in the public catalog | Reading an order by its unguessable link (status page) |
| Buyers sending new order requests | The owner reading, confirming, rejecting and progressing orders |
| Opening (or reopening) a closed catalog | Bookkeeping: sales, payments, refunds, purchases, expenses, customers, reports |

Manual bookkeeping is free forever. Existing customers can always follow their order, whether the seller unpublished the shop by hand or the plan ended.

## States

`entitlements/{uid}` holds `trialStartedAt` (server time) and `paidUntil` (null on trial). The rules and `src/lib/entitlement.ts` derive the state from it:

- **trial**: `now < trialStartedAt + 7 days`
- **paid**: `now < paidUntil` (also keeps the shop open after the trial window)
- **expired**: neither holds. Public products and new orders close; an expired owner cannot reopen a closed shop.
- **grace**: no entitlement yet, and `now < graceEnd()` in the rules. Only shops that were already open before this change get this; it is the migration window.
- **none**: no entitlement and grace is over (or the shop was never opened).

Expiry is computed from server time by the rules; the client only decides what to display.

## Starting the trial

- A new shop cannot be published without a running entitlement. The first publish writes the storefront and `entitlements/{uid}` in **one batch**; the rules require `trialStartedAt == request.time`, `paidUntil == null` and a published storefront. Creating the shop closed and flipping the flag later needs the same batch.
- Clients cannot edit or delete an entitlement, supply a start time or set `paidUntil`.
- A shop that is already open keeps `published: true` through ordinary edits even without an entitlement; only turning it on requires one. So the only shops that stay open with no entitlement are older ones, and only until `graceEnd()`.
- During grace an older owner sees a notice on Beranda with **Mulai uji coba 7 hari**, which creates the entitlement for the shop that is already open.

## Upgrading (paywall)

- Owners see their plan in the sidebar pill, in **Pengaturan → Langganan**, and in the notice on Beranda/Katalog (trial with 3 days or fewer left, expired, or older shop in grace). **Lihat paket** opens the paywall.
- The paywall shows the monthly price (`VITE_PLAN_PRICE_IDR`, default `49000`; `0` hides it), what the plan opens (catalog, WhatsApp orders, tracking page, promotion kit) and what stays free (all bookkeeping).
- **Upgrade lewat WhatsApp** opens a chat with `VITE_UPGRADE_WHATSAPP` (default `6281298590798`; an invalid number hides the button) prefilled with the shop name, the account email, the **account code** (the first 8 characters of the user ID, as is) and the current plan state.
- **Saya sudah bayar, periksa lagi** re-reads the entitlement, so the owner sees the plan turn active as soon as the operator sets `paidUntil`.

## Granting a paid plan

There is no payment integration. After payment is confirmed off-platform, find the owner by the account code from the WhatsApp message (the `entitlements` document ID starts with it; IDs are case-sensitive) and set `paidUntil` on `entitlements/{uid}` from the Firebase console or the Admin SDK to the end date (a Firestore timestamp). To end access early, set it to a past time. The owner's page reflects it on next load.

## Order tracking

Each order carries a frozen snapshot of the shop (`shop: { name, whatsapp, slug }`), which the rules require to equal the storefront's values at creation, and a `steps` map of progress stage to server timestamp. The status page reads only the order document, so tracking keeps working after the seller unpublishes or the plan ends. Orders created before this change have no snapshot; the page falls back to the storefront and shows a generic shop name if it is unreadable.

Order requests are limited to 6 lines. The Firestore rules engine allows 1000 expressions per request; the snapshot, plan and per-line checks fit with 6 lines (item field checks use `size() == 8` instead of a key list to stay inside the budget).

## Deploy order and settings

1. Set the end of the grace period: edit `graceEnd()` at the top of `firebase/firestore.rules`. It ships with a **placeholder (31 Dec 2026)**. Optionally set `VITE_GRACE_END` (ISO date) so the notice shows the same date.
2. Deploy the client and the rules together. New order creation requires the `shop` and `steps` fields, so an old client talking to the new rules cannot place orders, and a new client talking to the old rules is rejected on extra fields. Publish the rules right after the client build is live.
3. Optional: run `scripts/backfill-entitlements.mjs`. It is a **dry run unless `--apply`** is passed, needs `--project`, and with `--apply` needs `GOOGLE_APPLICATION_CREDENTIALS`. It lists open shops with no entitlement and can create trials (or grandfather them with `--paid-until`). Review the dry run first.

## Tests

- `tests/catalog/rules.mjs` and `tests/catalog/rules-subscription.mjs` run against the Firestore emulator (see `docs/catalog-pilot.md`); the subscription suite substitutes the grace constant to test both sides of it and seeds past timestamps to test expiry.
- `scripts/check-entitlement.mjs` covers the client state logic, including the 7-day boundary.
