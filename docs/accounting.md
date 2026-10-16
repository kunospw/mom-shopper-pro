# Accounting rules

Every number in the app comes from one function, `buildReport` in `src/lib/report.ts`, over the recorded facts (sales, payments, refunds, purchases, expenses). It re-derives each sale from its recorded lines instead of trusting stored totals, so a stale or legacy record cannot skew a report. Periods are **local calendar** periods (`src/lib/period.ts`), never slices of a UTC timestamp.

## Definitions

| Metric | Definition | Dated by |
| --- | --- | --- |
| Penjualan (revenue) | Totals of non-cancelled sales, minus sales-return refunds | Sale date; a return counts in the month of the refund |
| Modal barang terjual (COGS) | Unit cost x quantity on the sold lines. Purchases are never subtracted from profit in addition to this | Sale date |
| Biaya per penjualan (fees) | Admin/packing fees entered on a sale | Sale date |
| Biaya usaha (expenses) | Expense records | Expense date |
| Ongkir pembelian (purchase shipping) | Freight on a stock purchase, a cost **when paid** (cash basis), not when the stock is later sold | The purchase's own date |
| **Laba bersih** | `revenue - COGS - fees - expenses - purchase shipping` | |
| Uang diterima (net cash) | Payments minus refunds, over **all** sales including cancelled ones (money that actually moved) | Payment/refund date |
| Pembelian stok | Purchase totals recomputed from lines + shipping; informational cash outflow, not a profit input | Purchase date |
| Belum dibayar | What buyers still owe on non-cancelled sales **as of now**, independent of the selected period | Now |
| Perlu dikembalikan | Money still held on cancelled sales | Now |

Shipping charged to a buyer is part of the sale total (revenue). Discounts reduce it and cannot exceed the order.

## Payments and refunds

A payment record always has a positive whole-Rupiah `amount`; `kind: "refund"` marks the direction, and records without `kind` (all data created before refunds existed) are payments. Nothing is silently clamped: `newPayment`/`newRefund` throw on zero, negative, fractional or non-numeric amounts, and `saveSale` refuses to write a ledger that fails `validatePayments`:

- the running net (payments - refunds, in recorded order) never goes below zero, so **a refund can never exceed what is currently held**, singly or cumulatively; a refund on an unpaid sale is rejected;
- a refund may not be dated before the first payment;
- an active sale cannot be paid beyond its total.

Two kinds of refund, chosen automatically from the sale's state when it is recorded:

- **return** (sale active): a sales return. It lowers revenue in the month of the refund and lowers cash; it does **not** re-open the receivable (the buyer does not owe the money again).
- **cancellation** (sale cancelled): cash only; revenue/COGS/fees of the cancelled sale are already excluded. If the cancelled sale is later re-opened, the buyer owes the refunded amount again.

Stock is not changed by a refund, and a return does not reverse COGS (restock/cost reversal is a separate, future decision).

## Known limits

- COGS uses the unit cost recorded on each sale line (taken from the product's private cost when added), not a moving average of purchase prices.
- Freight entered as a purchase **and** as an `ongkir` expense is counted twice; enter it once.
- Date-only fields (purchases, expenses) are stored at local noon; sale dates keep the time entered.
