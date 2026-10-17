# Catalog pilot

The existing seller workspace remains at `/`, `/transactions`, `/reports`, and `/settings/:section`. `/catalog` is a new authenticated owner destination. `/shop/:storeId` is a public buyer page outside the owner AuthProvider and private data services. Buyers need no account and see no seller dashboard navigation.

## Scope and data

One Firebase Auth user owns one storefront, identified by their UID. This is not an organization or multi-tenant membership system. Product listings are independent of transaction line items: nothing is copied from transactions, and catalog edits/deletes never update historical transactions.

| Path                              | Contents                                                                                                               | Intended access                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `users/{uid}`                     | Existing private profile, business and payment settings                                                                | That owner only                                                       |
| `users/{uid}/transactions/{id}`   | Existing private operational records                                                                                   | That owner only                                                       |
| `storefronts/{uid}`               | Explicit public shop name, description, ordering WhatsApp, accent, logo, published flag, update time                   | Owner; anonymous reads only while published                           |
| `storefronts/{uid}/products/{id}` | Name, description, category, integer IDR price, image, availability/ETA, one option group, published flag, update time | Owner; anonymous reads only when both store and product are published |

The public reader requests only `published == true` listings from the server. Owner writes use the current Firebase Auth UID, not a user-supplied store ID. Public fields are explicitly projected and validated; bank details, purchase costs, margins, customer names, invoices, and account email are never published by these services. Firestore rules also reject unknown catalog fields; client projection alone is not a security boundary.

The owner's business name/accent/logo are suggested when first setting up a store. Saving the public shop is explicit. Existing payment and transaction fields are not auto-copied. A closed store and new products default to unpublished. A published product marked unavailable stays visible but cannot be ordered.

## Buyer experience

Buyers search/filter products, inspect photos and descriptions, select a required option when present, and add quantities to their selection. The selection is stored per storefront in **sessionStorage**, contains only product IDs/options/quantities, and is reconciled against current listings on load. If browser storage is unavailable, it continues in memory. It is not a saved order.

Before preparing a WhatsApp link, the app fetches current store/products from Firestore again. Changes to prices, options, availability, store contact, or selected products require the buyer to review and check again. Reopening the selection requires a fresh check. The buyer then explicitly opens WhatsApp with a structured request containing product codes, choices, quantities, current prices, preorder estimates, and subtotal excluding shipping. The seller confirms stock, final price, payment, and fulfillment manually.

The request is saved as a **pending order** (see below) and the buyer is handed to WhatsApp with the order code. A seller must verify it before confirming. No stock is reserved, payment collected, or sale recorded until the seller confirms. Server revalidation cannot reserve a price or prevent a change after checking.

Catalog reads/writes fail visibly on network errors. They do not use the legacy transaction localStorage fallback or report an unsaved change as saved. Existing transaction persistence is unchanged.

## Security prerequisite and activation

The live rules supplied on 2026-10-15 include a global recursive `allow read, write: if request.auth != null`. That permits any signed-in account to access other owners' private data and overrides more restrictive matches. Adding a catalog match beneath it does **not** fix owner isolation.

`firebase/firestore.rules` is a proposed complete replacement based on that supplied policy. It preserves owner access to their profile and all nested records, removes the global grant, and adds validated owner writes and published-only public reads for catalogs. Unmatched collections are denied. The repository currently uses only the private user paths shown above; confirm any other clients/integrations before publishing the tighter policy. No live rules or production records were changed by this implementation.

1. Back up the current live policy. Run the emulator suite below and review any failures before publishing.
2. In Firebase Console → **Firestore Database → Rules**, review and publish the full contents of `firebase/firestore.rules`. Do not append it while keeping the permissive catch-all. This is separate from Vercel deployment; no Firebase Auth/provider configuration change is needed.
3. Verify the owner can still load/save their profile and transactions. Verify another signed-in test owner cannot read those paths. Verify an anonymous browser cannot read either private path.
4. In **Katalog → Atur toko**, enter a public shop name and an ordering WhatsApp number with country code (for example `6281234567890`). Add a few listings. Publish intended products, then open the shop.
5. Use **Lihat sebagai pembeli** or copy its link. Test it in an incognito browser without signing in, including options, preorder messaging, and closing the shop. Confirm drafts are inaccessible, not merely absent from the UI.

Until the replacement policy is published, the existing owner UI can save catalog data under the old broad rules, but anonymous buyers cannot read it and owner isolation remains insecure. Do not invite other sellers until the access tests and policy replacement are complete.

If activation fails, close the storefront and investigate the denied path. Keep restrictive owner rules in place; do not restore a globally permissive grant to make a public catalog work. Existing user/transaction documents require no migration.

## Validation

Model and regression checks use the existing dependencies:

```bash
node scripts/check-catalog.mjs
node scripts/check-design.mjs
npx --no-install tsc -p tsconfig.app.json
npx --no-install tsc -p tsconfig.node.json
npm run build
```

The rules suite uses the exact proposed deployment file and a demo project in a local Firestore emulator. It covers anonymous/private boundaries, drafts/closed shops, cross-owner reads/writes/deletes, owner profile/transaction compatibility, product queries, field validation, and unknown fields, plus the trial and tracking rules. It needs Node 20+ and Java 21+; the emulator tooling is installed outside the application dependencies on first run:

```bash
npm run test:rules          # rules suites on the Firestore emulator
npm run test:integration    # the real app against the Auth + Firestore emulators
```

These commands do not deploy rules and only accept `demo-` projects. See [tests/README.md](../tests/README.md).

Desktop/mobile browser checks with isolated sample data cover owner product creation/edit/delete, failed-write recovery, publishing/closing shops, required options, unavailable items, search, cart persistence, WhatsApp content, price-change review, unsaved edits, and absence of owner authentication modules on the buyer entry route. They make no production requests. Repository-wide lint still has its pre-existing 11 errors and 10 warnings; new catalog modules pass focused lint.

## Pilot limits

- One store per owner, one photo and one option group per product, up to eight choices, IDR pricing, six distinct selections per request (the most Firestore rules can validate in one write), and 1–99 units per selection.
- Photos are locally resized to bounded raster data URLs (product: 180,000 characters; logo: 140,000). No external image service or Firebase Storage setup is added. This suits a very small pilot; all published product documents are fetched on catalog load. Reconsider image storage, pagination, and query costs if the catalog grows.
- No custom domains, buyer accounts, stock reservation, subscription billing/trials, AI, payment gateways, or new tenant roles. Shop links may use a readable slug under `/shop/`.
- This pilot does not add bot/abuse protection or an SLA. Validate seller usefulness and buyer conversion before broad rollout.

Ask the pilot seller which few products to publish, whether choices affect price (this version uses one price), what ready/preorder promises they can reliably fulfill, which number should receive requests, and whether incoming WhatsApp messages save them time. Observe one unfamiliar buyer completing the flow before expanding the product.

## Orders, shop links and option prices

| Path | Contents | Access |
| --- | --- | --- |
| `slugs/{slug}` | `{ storeId }`, 3-30 lowercase letters, digits or hyphens; reserved words refused | Anyone can read one; nobody can list; only the owning UID can create or delete, and only if the storefront's own `slug` field matches (checked atomically with `getAfter`) |
| `storefronts/{uid}/orders/{orderId}` | Buyer name (<=60), note (<=300), up to six frozen item snapshots, subtotal, status, progress, tracking number, seller note | Anyone can create on a **published** store with `status: pending` and exact field/size validation; anyone holding the unguessable ID can read it (buyer status page); only the owner can list; the owner may change only `status`, `progress`, `trackingNo`, `sellerNote` |

- **Buyer flow**: pick products (option chips show per-option prices; a price of 0 means "use the product price") -> enter name -> **Kirim pesanan via WhatsApp**. The app re-reads the live catalog, refuses to send if prices or availability changed, saves the pending order, then opens WhatsApp with `Pesanan #CODE` and a link to `/shop/<slug>/order/<id>`. If saving fails, WhatsApp is not opened.
- **Owner flow**: **Pesanan** lists pending requests with warnings when a listing changed. **Konfirmasi** opens the sale form prefilled from the request; saving creates the sale, adjusts stock and marks the order confirmed in one atomic batch. **Tolak** rejects it with an optional reason and creates no sale. Later fulfillment steps and tracking numbers on a catalog sale are mirrored to the public order (never delivery notes or private data).
- **Old links keep working**: `/shop/<uid>` resolves as before; `/shop/<slug>` is preferred when set.
- **Legacy listings**: products saved before this change stored options as plain strings and had no `kind`; they still display (normalised on read) and are rewritten in the new shape the next time they are saved.
- **Limits**: six distinct lines per order, rules cannot verify prices against the catalog (the owner inbox flags mismatches), and there is no anti-spam beyond field limits. Firebase App Check is a sensible follow-up.

### Publishing the updated rules

The new rules require `slug` on storefronts and `kind` plus object options on products. Publish `firebase/firestore.rules` together with the app deployment: reads keep working at any time, but an older app version cannot save storefronts or products under the new rules. Run the emulator suite first; it now covers orders, slugs, option validation and the six-line cap.
