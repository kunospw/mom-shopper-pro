# Bookkeeping model

Sales, purchases, expenses, customers and stock live under the signed-in owner's private path. The existing rule `match /users/{userId}/{document=**}` already covers them, so **no Firestore rules change is needed** for this model.

| Path | Contents |
| --- | --- |
| `users/{uid}/sales/{id}` | Customer snapshot, line items (`name`, `option`, `kind` physical/digital, quantity, unit price, unit cost), shipping, discount, fees, `payments[]`, `fulfillment`, derived totals |
| `users/{uid}/purchases/{id}` | Restock entries: supplier, items, shipping, total |
| `users/{uid}/expenses/{id}` | Ongkir, packaging, ads, admin, other |
| `users/{uid}/customers/{id}` | Name, WhatsApp, address, note |
| `users/{uid}/inventory/{productId}` | Private `cost` and optional `stock` (`null` = not tracked). Never published with the catalog |
| `users/{uid}/meta/books` | One-time migration marker |

Legacy `users/{uid}/transactions` documents are copied once into `sales`/`purchases` (same document ID, so repeating is harmless) and then left untouched as a backup. A legacy Paid sale becomes one payment of the full total; Pending has none.

## Rules of the model

- Derived values (`subtotal`, `total`, `cost`, `profit`, `paid`, `balance`, `paymentState`) are recomputed by `derive()` in `src/lib/books.ts` on every write. Profit is `total - cost - fees`; shipping is charged to the buyer and discounts reduce `total`.
- Payment state: `unpaid` (nothing paid), `partial` (DP), `paid`. Overpayment is rejected in the UI.
- Fulfillment: physical `confirmed → packed → shipped → done`; all-digital `confirmed → delivered → done`; `cancelled` and re-open are available. Delivery codes for digital goods stay in the owner's private `deliveryNote`.
- Stock moves only for products with a tracked stock number: down when a sale is created or re-opened, up when it is cancelled, edited or deleted, and up on purchases. Selling below zero is allowed.
- Reports: sales value is by sale date; cash received is by payment date; net profit is sales profit minus expenses. Cancelled sales are excluded.
- There is no localStorage fallback. Failed writes surface as errors instead of silently diverging.

## Validation

```bash
node scripts/check-books.mjs
node scripts/check-design.mjs
node scripts/check-catalog.mjs
npx --no-install tsc -p tsconfig.app.json
npm run build
```
