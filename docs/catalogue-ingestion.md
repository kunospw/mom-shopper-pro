# AI catalogue ingestion MVP

## Shopee share text (pipeline `shopee-link-v1`)

For a seller who resells Shopee items to her own contacts. In the Shopee app she taps Share, then Copy, and pastes the text into "Atau tempel dari Shopee". `POST /api/ingest-catalogue` with `{action:"link",text}` (at most 1,000 characters) accepts text containing exactly one `https://s.shopee.co.id/<code>` link.

- `server/catalogue-shopee.ts` reads the name and listed price from Shopee's Indonesian wording, `Cek <name> dengan harga Rp<price>[ - Rp<max>]. Dapatkan di Shopee`. Other wording, or a bare link, leaves name/price empty; nothing is guessed. Names over 80 characters (the product schema limit) leave the draft name empty and are shown in full for the seller to shorten.
- The Shopee price is stored on the job as `source.listedPrice`/`listedMax` and shown as a reference with a "Pakai Rp…" button. The draft price stays empty: a reseller sets her own selling price. No AI or OCR is used.
- `resolveShopeeLink` requests only `https://s.shopee.co.id/<validated code>` with `redirect: "manual"`, a 5-second timeout and the honest agent `LarisKu-LinkPreview/1.0 (+https://larisku.dyahrini.tech)`. It records shop/item IDs only when the first redirect is `https://shopee.co.id/opaanlp/<shopId>/<itemId>`. The Shopee product page is never requested and no user-supplied URL is fetched. Failure still creates the draft from the text.
- With an honest agent Shopee returns no Open Graph name/photo (verified on four real links, 28 October 2026); that metadata appears only for a link-preview crawler agent, which this code deliberately does not impersonate. Photos are therefore added by the seller. Shopee listing photos belong to the original seller.
- Each Shopee draft therefore requires the seller's own photo before confirmation. The review shows a "Foto produk" picker; the browser squares and compresses it with the Catalog editor's `catalogPhoto` (WebP data URL, at most 180,000 characters). `save` stores it as the draft's `photo` (`photoSchema`: PNG/JPEG/WebP data URL only, never a remote URL), and `confirm` rejects a Shopee job with `photo-required` while any draft has none, then writes it to the product's `image`. Catalogue-file drafts keep photo optional.
- One job per seller and link code (SHA-256 of `shopee-link-v1` + code); pasting the same link again reopens it. Link imports have their own cap of 100 per seller per UTC day (`catalogueIngestionLocks/links_<uid>`). Review, correction and atomic confirmation are unchanged; products are created with `published:false` only after confirmation.
- Shopee Affiliate Open API access is granted per account on request and was not available to this seller (29 October 2026), so it is not used.

## Layout-aware OCR follow-up (pipeline v2)

Price-list posters place several cards side by side. Plain Tesseract text joined neighbouring cards on one line, so the model could not tell which heading, plan label and price belonged together. `server/catalogue-layout.ts` now rebuilds reading order from Tesseract TSV word boxes: touching words form a card, a price-only column joins the row-aligned labels on its left, and cards are listed per page column with `[Kolom N]` markers and ` | ` cell gaps. Only OCR words are emitted. The one rewrite is the stylised-font misread `BUIAN`/`8UIAN`, read as `BULAN`. Low-confidence short fragments from card borders/icons are dropped.

JPEG/PNG images under 2000 px on the longest side are enlarged 2.8x (at most 3000 px) through a one-page PDF and `pdftoppm` before OCR, so Poppler is now required for images as well as PDFs. The factor was tuned on one real photo: on a 425x455 crop of the APPS BY AZ poster, 2.8x read 5/5 headings, 8-9/10 plan labels and all 13 prices exactly; 2.5x lost most plan labels; 3x+ lost logos. This is not a general accuracy guarantee. PDFs still render at 2400 px; the same crop as a PDF misread one price (Rp28.000 as `AP. 26,000`), which grounding cannot detect because the wrong number is present in the OCR text.

The prompt describes the layout and asks for one product per priced row, named heading + current plan label + row text, using only words from the text. Grounding also clears a name containing a word absent from the OCR text (matched inside the text with spaces removed, so `HBOMAX` supports "HBO Max"); the model cannot name a brand from a logo that OCR missed. After grounding, source prices not used by any draft are stored as `unmatchedPrices` (counting repeats) and listed in the review screen. They never become drafts; the seller adds a real omitted product manually after saving. The pipeline versions are now `vision-ollama-v2` and `tesseract-ollama-v2`, so v1 results are not reused.

Real local OCR measurements on the VPS (no AI call): the 13-offer crop as JPEG took 2.3s per OCR run and produced 13/13 exact prices; Grammarly's two plan labels and Zoom's "PRIVATE 100 PESERTA" pill were not recognised, so those four names can only be completed by the seller. The full 43-offer poster took about 5.7s at 3000 px and is still rejected before the model by the 15-price limit; its coloured pill labels are largely unreadable at that size. Model accuracy on the crop and end-to-end p50/p95 remain unmeasured until a separately authorised Ollama test.

## Real OCR activation follow-up

`CATALOGUE_OCR_ADAPTER=tesseract` selects the new local OCR adapter instead of Vision; Vision remains the default. Install Tesseract with English/Indonesian data and Poppler for one-page PDFs. Server-only optional paths are `CATALOGUE_TESSERACT_BIN`, `CATALOGUE_PDFTOPPM_BIN`, `CATALOGUE_TESSDATA_DIR`, and `CATALOGUE_OCR_LIBRARY_PATH`. The inspected private preview uses small Ubuntu packages extracted under ignored `node_modules/.cache/local-ocr`, without system-package changes or Google billing. No large LLM was downloaded.

Local OCR runs without a shell, with fixed file paths/arguments, a single OCR thread, a 12-second subprocess deadline, bounded output, private temporary files and cleanup on success/failure/abort. Child processes receive only the required runtime paths/locale, never the Ollama key. Default sparse-text mode 11 is used for price-list posters; `CATALOGUE_TESSERACT_PSM=3` selects automatic page layout instead. PDFs render completely as a single image bounded to 2400 pixels per side; no page is silently skipped. Local OCR needs no external-service enable flag. Sending text to Ollama still requires the explicit external flag and server-only key.

The production runtime supplies a server-owned pipeline version (`vision-ollama-v1` or `tesseract-ollama-v1`) to the submission hash. Real extraction therefore cannot return a cached manual/mock result for the same file. Old jobs/confirmation receipts remain stored and readable; their products are untouched. The private real-mode preview blocks confirmation of old fixture jobs and ignores them when resuming an import.

The private key-entry page `/__preview/setup-ai` is a development-only helper in ignored cache. It verifies the signed-in interactive seller, requires same-origin POST, uses a password input and JSON request, returns no key value, sets no-store/CSP headers, and stores the key in server process memory only. The field is cleared after submission and the key is not written to disk/Git/logs/browser storage. Restarting the preview intentionally clears the key. The preview limits a setup submission to one extraction test with at most two provider HTTP attempts; explicit user authorization for external paid processing is still required. No cloud call occurs merely by saving the key. API setup security checks passed for cross-origin (403), unsigned (401), other-seller (403), masked input, authenticated submission, cleared input and no browser persistence using a dummy/intercepted request.

Actual local OCR on the supplied 9 October APPS BY AZ image produced 1331 characters in 1.538s for JPEG; its one-page PDF equivalent produced 1366 characters in 4.340s. These are real OCR measurements, not AI/end-to-end timings or accuracy guarantees. A single explicitly authorized Ollama extraction test then failed after 10.2s with no new drafts; the user's product count stayed 12 to 12. The previous generic error did not preserve the cause, so it cannot be claimed to be a timeout or a bad key. Diagnosis now distinguishes authentication, access, quota, missing service/model, network, timeout and invalid response using safe codes only. AI response timeout was increased from 8s to 20s, with low thinking requested for GPT-OSS; the full processing deadline remains 35s. No further paid call is implied by local verification.

The explicitly approved retry reached Ollama and returned 15 drafts in 8.22s, but failed quality review: duration labels such as `1 BUIAN` became product names, a source Rp11,000 price became Rp112,000, and the model claimed completeness despite 43 price points in the OCR. This is evidence of connectivity, not accurate extraction or meeting the five-second target. The job was marked failed with `catalogue-price-limit`; its 15 draft documents remain retained and cannot be confirmed. Existing emulator products stayed 12 before and after both real tests. There were no production writes.

`server/catalogue-quality.ts` now counts explicit Rp/IDR and grouped-thousands prices before the LLM. More than 15 rejects the whole file before any model call; split dense catalogues into smaller files. This conservative heuristic can reject duplicates or other grouped numbers and cannot prove all prices were recognized. Duration-only/plan-only names and prices absent from numeric OCR evidence become null and require correction. Evidence presence does not prove correct product-price association. The prompt also requires identifiable names and forbids omitting offers to fit the cap. Confirmation independently checks the recorded source-price limit.

Additional checks: `npm run check:local-ocr` (Linux subprocess bounds, failure/abort, secret exclusion and temporary-file cleanup), extended `npm run check:ingestion` (mocked provider failures/retry counts and quality helpers), and the ingestion emulator suite (pipeline separation, pre-AI rejection without provider invocation, no automatic creation, ownership and confirmation) pass. No additional paid inference was used to test these safeguards. Accuracy on a supported small real catalogue and end-to-end p50/p95 remain unverified. The development preview restart cleared its memory-only key; no key was copied to disk.

Implemented for `kunospw/mom-shopper-pro`, baseline `feat/configurable-seller-design` at `7fc1e8413193e5084505cd2edefd30ebc32a2087`. Development branch: `feat/ai-catalogue-ingestion`, isolated VPS worktree `/home/drini/personal/larisku/catalogue-ingestion`. The original checkout and its untracked planning documents are preserved. No AGENTS.md was found in the checkout, project parent tree or ancestor locations checked. Planning draft claims were verified against source, not assumed to describe deployment.

## Design and schema

The existing application is Vite/React, Firebase Auth, client Firestore, Zod and Playwright with custom Node checks. There is no Cloud Functions project. Existing API functions use TypeScript HTTP handlers (`api/shop-chat.ts`); this change follows that pattern, adding `ingestCatalogue` and a prepared loopback Node entry point for the static VPS deployment. It does not deploy anything.

`POST /api/ingest-catalogue` accepts JSON with a Firebase ID token in `Authorization: Bearer ...`. The server verifies its signature/project/expiry and revocation using Admin Auth. No UID, paths, publication state or ownership fields are accepted in request/model schemas. The production runtime refuses any Firebase project other than `truly-yours-51176`. Tests require both Auth and Firestore emulators and a `demo-` project.

Actions:

- `ingest`: `{action:"ingest",mime,data}` where data is base64 file bytes. Validates size/signature/dimensions/page count, acquires shared transaction leases, calls OCR and LLM, validates the entire response, then atomically persists the complete draft batch. Returns job ID, status and draft IDs/data.
- `list`: `{action:"list",after?:jobId}` pages through this seller's imports, 20 per page with an explicit next cursor. History supports recovery on another device. `status`: `{action:"status",jobId}` reloads a job and its drafts.
- `save`: `{action:"save",jobId,drafts:[{id,candidate}]}` accepts exactly the original draft set. It validates every candidate and owner independently of Firestore rules and atomically saves corrections with a new revision. Missing name/price may remain null while reviewing.
- `confirm`: `{action:"confirm",jobId,revision,confirmed:true}` checks the stored revision, every owner and every final product field, then creates all products and marks all drafts and the job confirmed in one Firestore transaction. A missing field, collision or write failure creates no partial products and leaves drafts available. Repeated/concurrent confirmation returns the durable original receipt without recreating products, even if a product was subsequently edited/deleted.

Private data paths are `catalogueIngestions/{uid}/jobs/{hash}` and `.../drafts/{00..14}`. A separate top-level namespace avoids the existing broad recursive owner permissions under `users/{uid}`. Clients can read only their own jobs/drafts; **all client writes are denied**, including owner draft creation, editing and deletion. Corrections use the authenticated API. Shared leases and daily counters are in `catalogueIngestionLocks`, unreadable/unwritable by clients. Existing product/public-catalogue rules are unchanged. Admin SDK bypasses rules; backend validation and IAM protect server operations. No service-account identity is claimed to appear in `request.auth`.

Final products retain the actual schema at `storefronts/{uid}/products`: integer whole Rupiah, required positive price and nonblank name, optional description mapped to `""` only on confirmation, and the existing empty-product defaults. Products are always `published:false`; the owner may later publish using the existing editor. SKU and HTTPS image URL have no compatible final-product fields: retained as private, editable metadata only. URLs are never fetched, displayed as images or copied into the raster-only `image` field. No existing product is modified; transaction `create` preconditions prevent overwrites. Every candidate is labelled uncertain, with explicit missing-field indicators and a seller review acknowledgement.

## Review flow (updated after interactive feedback)

The import panel reuses the existing `Section`, `MoneyInput`, form field styles, buttons and catalogue sheet. It has three visible steps: upload, review, save. Only name and Rupiah price are expanded per product; descriptions and private metadata are optional disclosures. The source image can be compared beside the list on desktop and expanded on phone. The browser's temporary image URL is revoked when the file/panel changes; this does not add server-side raw-file storage. Saved imports resume without showing hashes or internal status codes.

The seller can optionally save draft corrections for later. The main save button first persists any unsaved corrections, then confirms that exact revision through the existing atomic backend transaction. A separate draft-save click is no longer required. The acknowledgement resets after editing, and missing/invalid fields still block final confirmation. A success screen links back to the product list. No publishing behavior changed.

The private interactive preview may set `VITE_CATALOGUE_SAMPLE_IMAGE=1` together with emulator mode. Its supplied image and 12 manually transcribed offers from the right-hand column are development-only assets in ignored cache, clearly labelled as a bounded manual sample, not an OCR result or a complete import of the image. The original image and this personal fixture are not checked into the repository. The preview's original two mock drafts were backed up before replacing only their unchanged initial test state; no final products were created.

To run ingestion tests while that preview is open, use a separate emulator configuration and matching `INGESTION_TEST_FIRESTORE_PORT`, `INGESTION_TEST_AUTH_PORT`, `INGESTION_TEST_WEB_PORT`, and `INGESTION_TEST_CONFIG`. The verified design run used Firestore 8298, Auth 9298, frontend 8096, websocket 9250, hub 4450 and logging 4550. Tests still require loopback emulator hosts and the `demo-ingestion` project; their defaults remain unchanged. Do not run reset/clear tests against an interactive preview containing work you want to retain.

## Explicit limits and failure behavior

| Limit | MVP behavior |
| --- | --- |
| Formats | PDF, JPEG, PNG only; actual content checked, not just MIME |
| File | 2 MiB decoded; HTTP JSON body 2,900,000 characters maximum |
| PDF | Exactly 1 page; invalid/encrypted/multi-page files rejected before OCR |
| Raster | At most 16,000,000 pixels |
| OCR text | 18,000 characters maximum, never sliced |
| Offers/prices | 1–15 candidates; more than 15 detected price points rejects before LLM; overflow/incomplete model output fails the whole job |
| Provider response | 250,000 characters maximum; exceeding fails rather than truncates |
| Time | 8 seconds per Vision attempt, 20 seconds per LLM attempt, at most 2 attempts per HTTP stage; local OCR subprocesses have a 12-second limit, 35-second processing deadline; hosting must allow at least 60 seconds |
| Concurrency | 2 global OCR pipelines and 1 per seller, enforced by Firestore transaction leases, 60-second lease expiry |
| Quota | 20 extraction attempts per seller per UTC day; at most 3 attempts for the same file |
| Confirmation | Entire job only, at most 15 products / 31 writes; no partial selection |

One-page synchronous Vision annotation is supported by Google's API. This intentionally tiny workload fits the bounded HTTP runtime; there is no detached/unreliable background worker. If a request cannot finish it becomes failed; a killed process leaves a processing lease that expires after 60 seconds and can be retried by resubmitting the same original file. Status reads report expired processing jobs as failed. Raw input is not retained, so a retry after process death requires the original file. Identical seller+MIME+bytes map to the same SHA-256 job; processing/review/confirmed submissions reuse it without more provider calls. Different bytes constitute a different submission, not semantic duplicate detection.

The UI shows actual upload progress, processing status, a message after five seconds, safe retry guidance, persisted history, editable metadata, saved corrections, review acknowledgement and explicit confirmation. Missing name/price prevents confirmation. Other missing fields are visibly optional. Saving corrections alone never creates a product. Revision checks prevent confirming unseen changes from another tab.

Catalogue text is JSON-encoded into a user-data message, separated from a compact system prompt. No tools, remote links, model-supplied paths or commands are executed. Strict runtime validation rejects extra fields, invalid types/URLs, non-integer prices, malformed JSON and incomplete batches. This limits consequences of prompt injection; it does not prove that the model faithfully copied all products or never hallucinated. Seller review against the original file remains necessary. No raw catalogue, OCR text, model output, token or key is logged. Generic error codes replace provider error details.

Drafts and confirmation receipts currently have no automatic expiry. Retain receipts for idempotency. A future deletion/export/retention policy needs explicit product design; deleting a receipt would remove duplicate protection for the same file. No raw file storage, multi-page support, image cropping, SKU indexing, automatic publishing or existing-product updates are included.

## Local verification without paid calls

Requires Node 22+, npm, Java 21+ for Firestore, and Chromium with Playwright's OS dependencies. Run in an isolated development checkout:

```sh
npm ci
npx playwright install chromium
npm run typecheck
npm run check:ingestion
npm run check
npm run test:ingestion
npm run test:rules
npm run test:e2e -- tests/e2e/catalog.spec.mjs tests/e2e/buyer-order.spec.mjs tests/e2e/bulk-cropper.spec.mjs --workers=1
npm run build
npm run build:ingestion
```

`test:ingestion` uses `scripts/test-emulators.mjs ingestion`, project `demo-ingestion`, Auth `127.0.0.1:9198`, Firestore `127.0.0.1:8198`, and the real frontend at loopback port 8095 with real Firebase Auth, profile, product storage and Firestore rules. Its ingestion HTTP route runs the real backend against emulators with real emulator-issued ID tokens and fake OCR/LLM adapters; final saves are checked in emulator Firestore and the actual seller product list. Existing manual-entry/public-catalogue browser suites use the repository's existing mocks. No external service is called. Test tooling is installed under `node_modules/.cache/larisku-test-tools`, unless `CATALOG_TEST_TOOLING` is supplied. All test processes are temporary.

On the inspected VPS, Java, Chromium, fonts and missing browser libraries were extracted into this worktree's ignored cache without installing system packages. To reuse that already-prepared environment:

```sh
cd /home/drini/personal/larisku/catalogue-ingestion
export PATH="$PWD/node_modules/.cache/java21/bin:/home/drini/.nvm/versions/node/v22.23.4/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/node_modules/.cache/browsers"
export LD_LIBRARY_PATH="$PWD/node_modules/.cache/browser-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$PWD/node_modules/.cache/test-fonts.conf"
npm run test:ingestion
```

`npm ci` removes `node_modules`, including those cached runtimes. For a fresh installation, supply Java 21 and Playwright's documented OS/browser prerequisites before running the generic commands above; do not assume the isolated cache survives reinstalling dependencies.

For a manual local UI with actual emulators, use existing frontend emulator variables documented in `tests/README.md` and set the server emulator hosts to the matching ports. Keep the `demo-` guard and both hosts. External provider flags remain off; injected fake adapters are used by automated tests. Do not point an emulator run at the production project.

## Shopee-only pilot

`VITE_CATALOGUE_FILE_IMPORT=0` hides file upload in the client (the entry becomes "Impor dari Shopee") and `CATALOGUE_FILE_IMPORT=0` makes the API refuse `ingest` with `file-import-disabled` before any OCR/AI work, so the pilot needs no paid services (`INGESTION_ENABLE_EXTERNAL=0`). `CATALOGUE_HOST` sets the API's bind address (default `127.0.0.1`), for a proxy that runs in Docker and reaches the host through its bridge gateway. Release build and activation scripts for the VPS live outside this repository in `/home/drini/personal/larisku/deploy/`.

## Prepared deployment instructions — NOT EXECUTED

The inspected VPS documentation describes static frontend hosting with no API runtime. A frontend build alone cannot serve this feature. No live API, Firebase rules, IAM, billing or production behavior has been verified or changed during this task.

After separate owner authorization:

1. Provision a dedicated **LarisKu-only** runtime identity. Prefer workload identity/ADC; if a key file is unavoidable, put it outside source/release/web roots, readable only by the runtime account. Never reuse KAppHelper, Kairos, another app's agent or credentials. Supply `CATALOGUE_FIREBASE_PROJECT_ID=truly-yours-51176`. Never expose server secrets with `VITE_`.
2. Grant the minimum data-plane permissions for the LarisKu Firestore database: entity get/list/create/update and database metadata required by transactions. The ingestion process does not need delete, indexes, imports, backups, rules or IAM administration. Use a reviewed custom role rather than Owner/Editor/Firebase Admin. Add only Auth `firebaseauth.users.get` for revocation checks and the service-usage permission required for Vision billing/quota. IAM cannot constrain this Admin SDK identity to individual document paths; backend path and schema enforcement is essential. Bind roles only to the intended project/database where supported, and verify the exact minimal role in staging before production.
3. Separately approve any Vision API/billing enablement and paid-provider use. Provide a dedicated `CATALOGUE_OLLAMA_KEY` via secret injection. Default model is `gpt-oss:20b` on Ollama Cloud (configurable with `CATALOGUE_OLLAMA_MODEL`). No local model installation is needed. Validate account availability and budget before enabling calls.
4. Review and publish the proposed Firestore rules through the normal authorized release process. Emulator success is **not** proof of deployed rules. Keep existing subscription/grace settings and public-catalogue behavior under review; do not blindly replace unrelated live policy.
5. Build with `npm ci && npm run build:ingestion`. The prepared entry point is `dist-server/catalogue-http.mjs`. Configure an explicit unused `CATALOGUE_PORT` and run it under a dedicated service account bound to `127.0.0.1`, with request/body limits and at least a 60-second upstream window. Set `CATALOGUE_INGESTION_ENABLED=1`. Keep `INGESTION_ENABLE_EXTERNAL=0` until paid-call approval. A Vercel-compatible alternative is `api/ingest-catalogue.ts` with the same runtime, secrets and >=60-second configuration.
6. Plan/review a narrowly scoped same-origin proxy for **only** `/api/ingest-catalogue`. Do not execute existing activation helpers or alter shared infrastructure during development. This task does not start a daemon, change proxy files, restart/reload services, deploy or push anything.
7. Build/release the client with `VITE_CATALOGUE_INGESTION=1` only when the API and rules are ready. Enable `INGESTION_ENABLE_EXTERNAL=1` only after authorization. Smoke-test a dedicated test seller, isolation, failed extraction, retries, correction, hidden products and unchanged public/manual flows.
8. Rollback by disabling the frontend feature flag and server enable flag, then following the approved release rollback process. Keep private drafts and receipts intact; do not mutate products or roll back unrelated rules.

## Costs and performance target

Vision bills one OCR unit per page/image. Its published on-demand Document Text Detection price is first 1,000 units/month free, then US$1.50/1,000 up to 5 million (other account use shares that allowance). Thus one accepted one-page attempt is approximately US$0.0015 beyond the free allowance; a provider retry can add another unit. Ollama's published `gpt-oss:20b` price at inspection was US$0.07/million input tokens and US$0.30/million output tokens; an illustrative 5,000-input/2,000-output extraction is about US$0.00095 before retries. Account-plan terms may differ. Firestore reads/writes, identity checks, runtime and network charges also apply. No purchase or billing enablement occurred. Two explicitly authorized Ollama tests used the supplied key; account quota/cost applies. Local Tesseract OCR has no per-page API fee.

The <=5s target workload is one clear one-page JPEG/PNG/PDF under 250 KiB, up to five products and 3,000 OCR characters. Automated timings measure emulator persistence plus **mocked** OCR/LLM only. The later real dense-image retry took 8.22s and produced inaccurate results; it is not the declared small-file workload. Supported small-file accuracy and p50/p95 remain unmeasured; do not treat mock timings as evidence that the target is met. Capture upload-to-review p50/p95 with authorized samples before a performance claim. The >5s UI remains useful until completion/failure.

Primary references: [Vision synchronous files](https://docs.cloud.google.com/vision/docs/file-small-batch), [Vision pricing](https://cloud.google.com/vision/pricing), [Ollama model/API and pricing](https://ollama.com/library/gpt-oss:20b-cloud), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [server IAM](https://docs.cloud.google.com/firestore/native/docs/security/iam), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
