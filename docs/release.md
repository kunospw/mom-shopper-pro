# Release checklist

This branch changes the data model (refunds, order snapshots, entitlements) and the Firestore rules. Nothing is deployed by merging or by a Vercel build: rules and data steps are manual. Follow the order below.

## 0. Decide before deploying

| Decision | Where | Current value |
| --- | --- | --- |
| Grace period end for shops that were already open (`graceEnd()`) | `firebase/firestore.rules`, line 10, and `VITE_GRACE_END` | Placeholder `2026-12-31` |
| Plan price shown on the upgrade screen | `VITE_PLAN_PRICE_IDR` | `49000` |
| WhatsApp number for upgrades | `VITE_UPGRADE_WHATSAPP` | `6281298590798` |

`graceEnd()` and `VITE_GRACE_END` should hold the same date. After it passes, an open shop without a trial or plan stops showing products and taking new orders (bookkeeping and order tracking keep working). See [subscription.md](subscription.md).

## 1. Verify locally

```bash
npm ci
npm run typecheck
npm run check        # finance (3 time zones), catalog, design, contrast, status, entitlement, plan, setup
npm run build
npm run test:e2e     # browser suite on the mocked app, desktop + phone
npm run lint         # 10 known errors, all older than this branch: generated ui/ files, the plugin require() in tailwind.config.ts, legacy src/lib/storage.ts
```

Firestore rules and the real app against the emulators (needs Java 21+; tooling installs itself on first run, `demo-` projects only):

```bash
npm run test:rules         # both suites must print PASS
npm run test:integration   # sign-in, shop, orders, books, trial expiry, isolation
```

See [tests/README.md](../tests/README.md).

## 2. Deploy order

1. **Back up Firestore** (console export or `gcloud firestore export`).
2. **Set the environment variables** in Vercel (Production and Preview): the Firebase keys plus `VITE_PLAN_PRICE_IDR`, `VITE_UPGRADE_WHATSAPP`, `VITE_GRACE_END`. Optional shop assistant: `OLLAMA_API_KEY` (server only), `OLLAMA_MODEL`, `VITE_SHOP_ASSISTANT=1` (see [shop assistant](shop-assistant.md)). Never set `VITE_FIREBASE_EMULATOR` in Vercel.
3. **Publish the rules and deploy the client back to back**, at a quiet hour:
   - Publish `firebase/firestore.rules` in Firebase console → Firestore → Rules (the repo has no `firebase.json`, so use the console or your own deploy config).
   - Immediately deploy the client (merge to the production branch or promote the preview).

   The two must go together. The new rules require the shop snapshot on new orders and a trial or plan to open a shop, which the old client does not send: between the two steps, buyers on the old page cannot send orders and owners cannot open a closed shop. Existing orders, tracking and bookkeeping keep working throughout. A buyer with the old page cached just needs to reload.
4. **Optional: backfill trials** for shops that were open before the release. It is dry-run by default:

   ```bash
   node scripts/backfill-entitlements.mjs --project <id>                 # lists owners, writes nothing
   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/backfill-entitlements.mjs --project <id> --apply
   ```

   Without the backfill, those owners stay open until `graceEnd()` and get a 7-day trial when they next open the app.

## 3. Smoke test after deploy

On a phone and a desktop, with a test account:

- [ ] Sign in with Google; Beranda loads with the right numbers.
- [ ] New account: Katalog → **Buat toko** walks through the setup; "Buka toko sekarang" starts the 7-day trial (Pengaturan → Langganan shows it).
- [ ] Add a product with a photo and two options; it shows on the public shop link.
- [ ] As a buyer (private window): order from the shop, open WhatsApp, open the status link.
- [ ] As the owner: the order appears in Pesanan; confirm it into a sale; record a DP and the rest; mark shipped with a resi; the buyer's status page follows.
- [ ] Record a purchase linked to a tracked product (stock goes up) and an expense; Laporan's breakdown adds up.
- [ ] Invoice downloads as PDF; Promosi copies a broadcast and downloads a story image.
- [ ] Upgrade dialog opens and the WhatsApp link carries the account code.
- [ ] Android Chrome: "Pasang aplikasi" installs it; the icon, name and shortcuts look right; it opens full screen.
- [ ] iPhone Safari: Bagikan → Tambahkan ke Layar Utama; then Pengaturan → Tampilan → turn on notifications (iOS 16.4+).
- [ ] With the app open on Beranda, send an order from another device: sound, pop-up and notification arrive; "Lihat" opens that order.
- [ ] Airplane mode: the app still opens and shows the offline strip.

## PWA notes

- `public/sw.js` is served with `Cache-Control: no-cache` (see `vercel.json`) so browsers pick up new versions; the app then shows "Versi baru tersedia". When changing caching rules in `sw.js`, bump `VERSION` to drop old caches.
- The service worker never touches Firebase, Google sign-in or other cross-origin traffic (Google Fonts excepted), and only GET requests.
- Buyer pages (`/shop/...`) do not offer installing the seller app.
- New-order alerts use a Firestore listener on pending orders while the app runs. Alerts while the app is fully closed need Firebase Cloud Messaging plus a Cloud Function, which requires the Blaze plan.

## 4. Activating a paying shop

The owner sends the prefilled WhatsApp message with their account code (first 8 characters of their user ID). In Firestore, open `entitlements/{uid}` for the user ID that starts with that code and set `paidUntil` to a timestamp (for example one month ahead). The owner taps "Saya sudah bayar, periksa lagi". Details in [subscription.md](subscription.md#upgrading-paywall).

## 5. Rollback

Roll back the client and the rules together, as they were deployed:

- Client: redeploy the previous Vercel deployment.
- Rules: republish the previous version from the Firestore rules history.
- Data: entitlements and the new order fields (`shop`, `steps`) are additive and nothing existing is rewritten. Check that the previous rules let owners update orders that carry those fields before relying on a long rollback; the emulator suite in step 1 can be pointed at the old rules file to confirm.
