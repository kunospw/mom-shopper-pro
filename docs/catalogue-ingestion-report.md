# Catalogue ingestion implementation report

27 October 2026 — LarisKu, `kunospw/mom-shopper-pro`.

Interactive design follow-up: the upload/review UI now uses the existing form-card design, Rupiah inputs, compact editable rows, expandable details and source-image comparison. Final confirmation also saves current corrections, removing the mandatory intermediate draft-save step. Desktop and phone preview checks used the supplied image with a clearly labelled manual sample of 12 offers from its right-hand column; this is not a full OCR extraction. That initial design check created no products; the seller later explicitly confirmed the 12 sample products in the emulator. The image and fixture remain outside Git in the private development cache.

The design follow-up passed typechecking, targeted lint, the four ingestion journeys (including one-click correction/confirmation on phone), existing product-editor desktop/phone checks and the frontend build. Tests used separate emulator/frontend ports so they did not clear the interactive preview. `CatalogueIngestionView.tsx` contains the visual layout; `CatalogueIngestion.tsx` retains the authenticated state/actions. Test-port overrides were added to the existing test runner/config/context for this isolation.

Implemented in the isolated `drini` worktree `/home/drini/personal/larisku/catalogue-ingestion`, branch `feat/ai-catalogue-ingestion`, based on `7fc1e8413193e5084505cd2edefd30ebc32a2087`. The original checkout remains on `feat/configurable-seller-design` at that revision, with its existing untracked `docs/house-plans/` preserved.

## Delivered

- `server/catalogue-ingestion.ts`: authenticated ingestion, owner validation, persisted processing/failure/review states, duplicate-file protection, shared concurrency leases, daily/attempt quotas, corrected-draft saves and atomic/idempotent confirmation. No product is created before explicit confirmation; resulting products are hidden.
- `server/catalogue-adapters.ts`: one-page Google Vision OCR and compact Ollama structured-extraction adapters, runtime validation, response limits, timeouts/retries and prompt/data separation. External calls require a separate enable flag and server credentials.
- `server/catalogue-runtime.ts`, `server/catalogue-http.ts`, `api/ingest-catalogue.ts`, `scripts/build-ingestion.mjs`, `vite.config.ts`: server-only credentials, project/emulator guards, bounded HTTP entry points, local integration and a prepared VPS build. No daemon/service was started.
- `src/lib/catalogue-ingestion.ts`, `catalogue-client.ts`, `catalogue-token.ts`, `src/components/CatalogueIngestion.tsx`, `src/pages/Catalog.tsx`: schema mapping, upload progress, processing/failure/retry states, persisted import history, editable review, missing-field indicators, saved corrections and seller acknowledgement/confirmation. The catalogue panel close button now sits above its sticky header, fixing pointer access on desktop and phone.
- `firebase/firestore.rules`, `firebase/emulators.ingestion.json`: private owner reads, no direct client draft/job writes, no client access to locks; existing product/public-catalogue rules preserved. Admin writes are explicitly validated in the backend.
- `scripts/check-ingestion.mjs`, `tests/catalog/ingestion*.mjs`, `tests/ingestion/journey.spec.mjs`, `playwright.ingestion.config.ts`, `scripts/test-emulators.mjs`: mocked provider checks, real Auth/Firestore emulator security/transaction tests and desktop/phone journeys with the actual frontend Auth/product storage. Only OCR/LLM are mocked in the new journeys.
- Package scripts/dependency lockfile, `.env.example`, `.gitignore`, and [setup/deployment guide](catalogue-ingestion.md). Three non-null type assertions in `src/lib/catalog.ts` express the existing `reconcileCart` guarantee when importing the actual product schema into strict server compilation; no cart behavior changed.

## Exact verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS: app and server TypeScript |
| `npm run check:ingestion` | PASS: mocked Vision PDF/image responses, structured extraction, malformed/injected output, nullable fields, schema mapping and input limits |
| `npm run check` | PASS: all existing checks plus ingestion; includes 450 randomized ledgers across Jakarta/UTC/New York and 116 contrast pairs |
| `npm run test:ingestion` | PASS: backend/rules assertions plus 4 desktop/phone journeys using real frontend authentication and storage against Auth/Firestore emulators |
| `npm run test:rules` | PASS: existing catalogue/security suite and 38 subscription checks |
| `npm run test:e2e -- tests/e2e/catalog.spec.mjs tests/e2e/buyer-order.spec.mjs tests/e2e/bulk-cropper.spec.mjs --workers=1` | PASS: 6 tests, 4 expected skips for duplicate viewport combinations |
| `npm run test:e2e -- tests/e2e/catalog.spec.mjs --workers=1` | PASS after the close-button fix: 2 tests, 2 expected viewport skips |
| `npm run build` | PASS: frontend build; compilation is not deployment verification |
| `npm run build:ingestion` | PASS: prepared server bundle, without startup/deployment |
| `npx eslint src/components/CatalogueIngestion.tsx src/lib/catalogue-*.ts server/catalogue-*.ts api/ingest-catalogue.ts` | PASS |
| `git diff --check` / staged equivalent | PASS |
| `npm run lint` | FAIL: 10 pre-existing errors and 19 warnings in unchanged files; errors in `ui/chart.tsx`, `ui/command.tsx`, `ui/textarea.tsx`, `lib/storage.ts`, `tailwind.config.ts` |

The new emulator assertions cover real ID-token verification, unauthenticated/forged-token rejection, cross-seller read/save/confirm denial, direct owner/other/anonymous draft creation/edit/deletion denial, Admin-side validation despite rules bypass, missing-field atomic failure, product collision without overwrite/partial commit, concurrent/repeated confirmation, duplicate upload, failed/incomplete extraction and retry, per-seller/global leases, daily quota and attempt caps. Browser journeys cover upload → private review → correction → explicit confirmation → hidden final products visible in the actual seller list, plus unsupported input, a >5-second processing message, failure and safe retry. Screens were visually inspected. Expected permission-denied logs are negative assertions, not failed tests.

Whole-repository `npm test` / all unrelated browser/integration specs were not run. Existing tests above provide the relevant manual-entry, bulk-entry, public-catalogue/order and security regressions. Emulator success does not verify deployed rules or IAM. SDK metadata-lookup and stale Browserslist warnings were non-failing.

## Limits, costs and remaining live verification

PDF exactly one page, JPEG or PNG; 2 MiB; 16 MP; 18,000 OCR characters; 15 products; 35-second processing deadline; two shared active pipelines, one per seller; 20 attempts/seller/UTC day; three attempts per identical file. The API needs a >=60-second hosting window. Entire batches fail rather than truncate. Re-uploading identical bytes reuses the same job; different files are not semantically deduplicated. Drafts/receipts currently have no automatic retention cleanup.

The real product schema uses whole Rupiah and has no SKU or remote-image field. Those extracted values remain private review metadata. Missing required name/price blocks confirmation; missing optional description remains null in drafts and maps to the existing empty text only on confirmation. No URL is fetched. Default kind/availability/category/options follow the existing empty-product schema; richer extraction and images are outside this MVP.

A recorded mocked PNG upload → persisted review was **3.600 seconds**, with two fake candidates. This includes emulator/backend overhead and does **not** measure real OCR/LLM latency. The declared <=5-second target workload is a clear one-page file under 250 KiB, <=5 products and <=3,000 OCR characters. At that initial checkpoint no paid calls were authorized. Later explicitly approved real tests are recorded below; supported small-file p50/p95 remain unmeasured. The >5-second processing state is tested.

Activation requires a dedicated LarisKu runtime identity/ADC, reviewed least-privilege Firestore/Auth/usage IAM, authorized Vision service/billing, a dedicated server-only Ollama key and model access, proposed-rule review/publication, and a separately approved API runtime/proxy/frontend release. The guide details these steps; none was executed. The source and deployment documents were inspected; current live API/rules/site behavior remains unverified.

Expected marginal costs beyond provider allowances: [Vision](https://cloud.google.com/vision/pricing) about US$0.0015/page after its first 1,000 monthly OCR units, plus [Ollama `gpt-oss:20b`](https://ollama.com/library/gpt-oss:20b-cloud) about US$0.00095 for an illustrative 5,000-input/2,000-output extraction at inspected public rates; retries may add calls. Firestore/runtime/network charges and account-specific plan terms also apply. Initial mocked checks made no paid calls. The later follow-up used two explicitly approved Ollama tests with the supplied key; no purchase or billing enablement occurred.

No deployment, rule publication, production-data changes, push to GitHub, or production restart/reload occurred. All implementation and test work used the isolated LarisKu checkout and temporary loopback processes; no KAppHelper/Kairos application agents, databases, working trees or application credentials were used.

## Real OCR/AI follow-up and quality correction

Local Tesseract OCR and one-page PDF rendering are implemented in `server/catalogue-local-ocr.ts`, with subprocess time/output bounds, private temporary files, cleanup and no API-key inheritance. Dedicated optional server environment settings are documented in `.env.example`. Google Vision remains an alternative. The private development key-entry helper authenticates the seller, accepts same-origin submission only and holds the key in process memory without returning/logging/persisting it. It is outside Git and is not a production credential-management solution.

Two separately authorized Ollama tests used the supplied APPS BY AZ image. The first failed after 10.2s without drafts; its cause was not recorded. The retry after provider diagnostics/timeout improvements returned 15 drafts in 8.22s, but these were inaccurate: duration labels became names, one Rp11,000 source value became Rp112,000, and the output silently omitted offers despite claiming completeness. Actual local OCR detected 43 explicit price points. The result job is now failed with `catalogue-price-limit`, retains its 15 draft documents for audit and cannot be confirmed. Emulator products remained 12 before/after both tests; no final save occurred. This demonstrates connectivity only, not usable extraction accuracy or the <=5s target.

The new `server/catalogue-quality.ts` rejects more than 15 detected price points before calling the model. It clears duration/plan-only names and prices lacking numeric OCR evidence to null for seller correction. The prompt forbids dropping offers to fit the limit; confirmation independently checks the stored workload bound. This conservative heuristic does not prove completeness or correct price association and can overcount repeated/grouped numeric values. A supported small real catalogue still needs an authorized accuracy test. No further paid calls were made for the fix.

Final local verification includes `npm run typecheck`, `npm run check:ingestion`, `npm run check:local-ocr`, the isolated emulator `npm run test:ingestion` (including provider-not-called assertion for oversized source), frontend build and server build. The preview was restored after its development reload stopped it; its memory-only key was cleared. Nothing was deployed, pushed or changed in production.

## Layout-aware OCR follow-up — 28 October 2026

Delivered: `server/catalogue-layout.ts` (card/column reading order from Tesseract TSV word boxes), 2.8x enlargement of small JPEG/PNG images before local OCR, a layout-aware extraction prompt, rejection of names containing words absent from the OCR text, `unmatchedPrices` stored on review jobs and shown in the review screen, and pipeline versions `*-ollama-v2`. Details and limits are in the [setup guide](catalogue-ingestion.md).

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run check:ingestion` | PASS: adds synthetic TSV layout cases (side-by-side cards, spanning title, orphan price column, noise), name grounding, source/unmatched prices and prompt content |
| `npm run check:local-ocr` | PASS: TSV output, 2.8x render argument, no key in child environments, limits, failure/abort, temporary-file cleanup |
| `npm run test:ingestion` on isolated ports 8298/9298/8096 | PASS: emulator assertions (incl. omitted offer reported as an unmatched price, no product) and 4 desktop/phone journeys (incl. the unmatched-price notice) |
| `npx eslint` on ingestion files | PASS |
| `npm run build`, `npm run build:ingestion` | PASS |
| `git diff --check` | PASS |

Real local OCR on the VPS without any AI call: a 425x455 crop of the APPS BY AZ poster containing 13 offers (ChatGPT, Grammarly, CapCut, HBO Max, Zoom) produced all 13 prices exactly in about 2.3s; 4 of 13 offers lack a recognisable plan label in the OCR text. The full poster is still rejected before the model (48 detected price points). The crop is a private, ignored development file, not committed. No paid inference was used; model accuracy and end-to-end timing on the crop remain unverified. The interactive preview stopped during development reload and was restarted on the same loopback port with emulator guards and pipeline `tesseract-ollama-v2`; emulator products stayed 12 and the failed audit job kept its 15 drafts. Nothing was deployed, pushed, committed or changed in production.

### Authorised Ollama test on the 13-offer crop

One explicitly authorised `gpt-oss:20b` test sent the v2 OCR text of the crop (job `fda48f41…`, status review). It returned 13 drafts in 11.75s server time (about 2.3s local OCR, about 9.4s model), with no extra drafts and no unmatched prices. All 13 prices were correct and attached to the right service and duration. 7/13 names held service + plan + duration. The other 6: four lacked a plan label that OCR never read (two Grammarly drafts with identical names, two Zoom drafts without "Private 100 Peserta"); three carried OCR border fragments (`CapCut a 7 HARI`, `CapCut PRIVATE | J 7 HARI`, `HBOMAX a | PRIVATE | 2 1 BULAN`). The <=5s target was not met. Emulator products stayed 12; nothing was confirmed.

Follow-up without paid calls: the layout step now drops lone characters beside a label in rows without prices, while keeping price rows and short option rows such as `S | M | L`. On the same crop the OCR text no longer contains those fragments and CapCut/HBO plan labels read cleanly. The improved names are expected from that text but have not been re-measured with the model. The checks above, the isolated emulator/browser suite, targeted ESLint and `build:ingestion` passed again.

## Shopee share-text import — 28 October 2026

Delivered: `server/catalogue-shopee.ts` (share-text parser, first-redirect shop/item ID resolver), the `link` API action with its own daily cap, `source` on job views, a paste section and Shopee reference box (listed price, "Pakai Rp…", "Buka di Shopee") in the import panel, and `retiredPipelines`. The last also fixes a preview-only regression from the v2 bump: v2 jobs had been treated as old sample drafts, blocking resume and confirmation in the private real preview. Design and limits are in the [setup guide](catalogue-ingestion.md).

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npm run check:ingestion`, `npm run check:local-ocr` | PASS; unit cases include the seller's real Oral-B share text, price ranges, bare links, unknown wording, two links, look-alike hosts, honest agent/manual redirect and rejected redirect targets |
| `npm run test:ingestion` on isolated ports 8298/9298/8096 | PASS: emulator assertions (owner isolation, duplicate paste, resolver failure, selling price required, hidden product on confirmation) and 6 desktop/phone journeys including the paste flow |
| Targeted ESLint, `npm run build`, `npm run build:ingestion`, `git diff --check` | PASS |

Live checks without AI: the resolver returned shop/item IDs for all four seller-supplied links (24–466 ms). In the restarted private preview, pasting the real Oral-B share text as the interactive seller created one review draft (name from the text, empty price, Shopee price Rp22,600 as reference, real IDs) in 3.5s; emulator products stayed 12. The original preview was stopped and restarted on the same loopback port to load the new handler; its private config was backed up before patching. Nothing was deployed, pushed or changed in production.