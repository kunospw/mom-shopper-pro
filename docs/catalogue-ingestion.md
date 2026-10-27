# AI catalogue ingestion MVP

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
| Products | 1–15, complete output required; overflow/incomplete extraction fails whole job |
| Provider response | 250,000 characters maximum; exceeding fails rather than truncates |
| Time | 8 seconds per OCR/LLM HTTP attempt, at most 2 attempts per stage, 35-second processing deadline; hosting must allow at least 60 seconds |
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

Vision bills one OCR unit per page/image. Its published on-demand Document Text Detection price is first 1,000 units/month free, then US$1.50/1,000 up to 5 million (other account use shares that allowance). Thus one accepted one-page attempt is approximately US$0.0015 beyond the free allowance; a provider retry can add another unit. Ollama's published `gpt-oss:20b` price at inspection was US$0.07/million input tokens and US$0.30/million output tokens; an illustrative 5,000-input/2,000-output extraction is about US$0.00095 before retries. Account-plan terms may differ. Firestore reads/writes, identity checks, runtime and network charges also apply. Nothing was purchased or enabled, and no paid call was made.

The <=5s target workload is one clear one-page JPEG/PNG/PDF under 250 KiB, up to five products and 3,000 OCR characters. Automated timings measure emulator persistence plus **mocked** OCR/LLM only. Real OCR/LLM latency and accuracy remain unmeasured because paid calls were not authorized; do not treat mock timings as evidence that the target is met. Capture upload-to-review p50/p95 with authorized samples before a performance claim. The >5s UI remains useful until completion/failure.

Primary references: [Vision synchronous files](https://docs.cloud.google.com/vision/docs/file-small-batch), [Vision pricing](https://cloud.google.com/vision/pricing), [Ollama model/API and pricing](https://ollama.com/library/gpt-oss:20b-cloud), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [server IAM](https://docs.cloud.google.com/firestore/native/docs/security/iam), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
