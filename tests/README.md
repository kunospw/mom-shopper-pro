# Tests

Four layers, all local. None of them deploys anything or talks to a real Firebase project.

| Command | What it runs | Needs | Time |
| --- | --- | --- | --- |
| `npm run typecheck` | TypeScript (app + node configs) | – | ~20 s |
| `npm run test:unit` | `scripts/check-*.mjs`: money, periods and reports (3 time zones), entitlement, catalog, plan/promo, shop setup, status chips, import, PWA, design tokens, contrast | – | ~30 s |
| `npm run test:e2e` | Playwright on a **mocked** app (`tests/e2e`), desktop 1440×1000 and phone 390×844 | Chromium (`npx playwright install chromium` if missing) | ~4 min |
| `npm run test:integration` | Playwright on the **real** app against the Firebase **Auth + Firestore emulators** with the real `firebase/firestore.rules` (`tests/integration`) | Java 21+ | ~1.5 min |
| `npm run test:rules` | Firestore security rules suites (`tests/catalog`) on the emulator | Java 21+ | ~1 min |
| `npm test` | typecheck → unit → e2e | – | ~5 min |

Useful options:

- `npx playwright test tests/e2e/sales.spec.mjs --project=phone` runs one spec on one viewport.
- `E2E_SHOTS=/some/folder npx playwright test` also saves screenshots of the main screens.
- Reports: `test-results/e2e-report/index.html` and `test-results/integration-report/index.html`; failed tests keep a trace (`npx playwright show-trace …`).
- `npm run test:integration -- -g "trial ends"` passes Playwright arguments through.

## How the layers stay away from production

- **Mocked e2e** swaps the storage and auth modules for in-browser mocks (`tests/e2e/mock`, see its `vite.config.ts`). No Firebase SDK call leaves the page.
- **Integration and rules** run through `scripts/test-emulators.mjs`, which only accepts `demo-` project ids (`demo-larisku`, `demo-catalog-tests`). Firebase never connects a `demo-` project to real services. The app only talks to the emulators when it is built with `VITE_FIREBASE_EMULATOR=1`, and it refuses to start in that mode unless the project id starts with `demo-` (`src/lib/firebase-app.ts`). Production builds never set that variable.
- The emulator tooling (`firebase-tools`, `@firebase/rules-unit-testing`) is not an app dependency. The runner installs it once into `node_modules/.cache/larisku-test-tools`, or into `CATALOG_TEST_TOOLING` if you set it.
- Sign-in in the integration suite uses Google accounts that exist only in the Auth emulator. Google's own account-picker page is not tested (it lives on Google's servers); the app's emulator-only hook signs in with a Google credential and everything after that (`AuthContext`, profile creation, rules) is the production code.

## Coverage

| Feature | Mocked e2e (`tests/e2e`) | Emulator (`tests/integration`) | Unit / rules |
| --- | --- | --- | --- |
| Login screen: idle, signing in, failed, popup blocked, popup closed | `login` | sign-in creates the profile: `owner-journey` | – |
| Navigation, deep links, 404, phone "Lainnya" menu | `workspace` | – | – |
| Empty states for a brand-new account | `workspace` | `owner-journey` | – |
| Unsaved-changes guard (forms, settings) | `workspace` | – | – |
| Beranda: KPIs, chart, Perlu tindakan, search | `bookkeeping`, `search-beranda` | net profit: `books-plan` | `check-books` |
| Penjualan: create, DP, payments, refunds, cancel, edit, delete, stock | `sales`, `bookkeeping`, `workspace` | `orders-journey` | `check-books` |
| Pesanan: inbox, confirm into a sale, reject with reason, live alert | `buyer-order`, `order-alerts` | `orders-journey` | `rules-subscription` |
| Buyer shop, cart, price change, retry-safe submit, WhatsApp hand-off | `buyer-order`, `storefront-status` | `orders-journey` | `check-catalog`, `rules` |
| Order status page (C1–C5), tracking after unpublish/expiry | `storefront-status`, `trial-gate` | `orders-journey`, `books-plan` | `rules-subscription` |
| Shop setup wizard, shop editor, custom link | `shop-setup`, `buyer-order` | `owner-journey` | `check-setup`, `check-catalog`, `rules` |
| Katalog: products, options, stock, photos, crop | `catalog`, `bulk-cropper` | `owner-journey` | `check-catalog` |
| Bulk add (photos, CSV, paste) | `bulk-cropper` | CSV: `owner-journey` | `check-import` |
| Pembelian & biaya, stock from purchases | `costs-customers` | `books-plan` | `check-books` |
| Pelanggan | `costs-customers` | – | – |
| Laporan breakdown and identities | `reports` | `books-plan` (exact numbers) | `check-books` (randomized ledgers) |
| Trial, expiry, paywall, "Saya sudah bayar" | `trial-gate`, `paywall-promosi` | `books-plan` (time travel, rules deny) | `check-entitlement`, `rules-subscription` |
| Promosi (broadcast, images) | `paywall-promosi` | – | `check-plan` |
| Shop assistant (buyer Q&A, owner opt-in) | `shop-assistant` | `assistant` (real handler + rules, fake Ollama) | `check-assistant`, `rules` |
| Pengaturan and invoice PDF | `settings-invoice` | persistence: `books-plan` | – |
| Owner isolation, anonymous access | – | `books-plan` | `rules` |
| Installable app, offline shell, update, order notifications | `pwa`, `order-alerts` | – | `check-pwa` |
| Dark mode on every page | `workspace`, `reports`, `settings-invoice` | – | `check-contrast` |
| Accessibility (axe, WCAG 2.1 AA: no serious/critical) on every workspace page, dialogs, buyer pages, login, 404 | `accessibility` | – | `check-contrast` |
| No horizontal overflow at 390 px | most specs (`noHorizontalOverflow`) | – | – |

Not covered automatically: answers from the real Ollama Cloud model (see the preview checklist in `docs/shop-assistant.md`), Google's real account picker, real WhatsApp delivery (wa.me links are checked, not opened), browser install prompts on real phones, and printing.
