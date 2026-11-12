# Public pages and account deletion

What a visitor sees before signing in, and how an owner removes their account. Nothing here is deployed automatically.

## Front door

| Path | Who sees it | Source |
| --- | --- | --- |
| `/` | Signed-out visitors: the introduction (benefits, steps, price, questions). Signed-in owners: Beranda. | `src/pages/Landing.tsx`, chosen in `src/components/ProtectedRoute.tsx` |
| `/?source=pwa` | The installed app's start URL. Signed-out: straight to sign-in, never the introduction. | `public/manifest.webmanifest` |
| `/login` | Sign-in. Links to the terms and the privacy policy. | `src/pages/Login.tsx` |
| `/privasi`, `/ketentuan` | Everyone. | `src/pages/Legal.tsx` |

The price and trial length on the landing page and in the terms come from `VITE_PLAN_PRICE_IDR` and `TRIAL_DAYS`, the same values the paywall uses. "Hubungi kami" uses `VITE_UPGRADE_WHATSAPP`. Set `VITE_DEMO_SHOP` to a shop slug to show "Lihat contoh toko"; ask that shop's owner first.

### Legal texts

`src/pages/Legal.tsx` describes what the app does today: what is stored, who can read it, which outside services process it (Firebase, Google Fonts, Ollama Cloud for the shop assistant, Shopee links on import, WhatsApp). They are plain-language drafts and have not had a legal review. Whenever data handling changes (a new outside service, analytics, payments), update the text and the `UPDATED` date in the same release.

### In-app browsers

Google sign-in fails inside the browsers built into Instagram, Facebook, TikTok, LINE and similar apps, and sellers often arrive from them. `src/lib/in-app-browser.ts` recognizes them from the user agent. The login page then names the app and offers "Salin alamat halaman" and, on Android, "Buka di Chrome" (an `intent://` link). iOS has no such link, so the notice explains the app's own "open in browser" menu.

### Link previews and search engines

- `index.html` carries `og:image` and `twitter:image` pointing at `public/og-image.png` (1200×630). Chat apps need an absolute URL, so the domain is written out there, in `public/robots.txt` and in `public/sitemap.xml`. Change all three with the domain; `scripts/check-launch.mjs` fails if they disagree.
- Regenerate the picture with `node scripts/make-og-image.mjs` (needs Playwright's Chromium).
- Every page gets the same preview, including shop links: the site is a static single-page app, so a crawler never sees a shop's own name or photo. Per-shop previews need a server that answers `/shop/:slug` for crawlers.
- `robots.txt` keeps order status links (`/shop/*/order/`) out of search engines.

### Platform credit

Shop pages, order status pages and the closed-shop page end with "Ditenagai LarisKu · Buat toko seperti ini", linking to `/?ref=toko` (`PoweredBy` in `src/components/shop/shop-ui.tsx`). The `ref` value is not recorded anywhere yet.

## Account deletion

Pengaturan → Akun → **Hapus akun dan data**. The owner types `HAPUS`, Google asks them to pick the account again, and `src/lib/account-delete.ts` then removes, in this order:

1. shop products, the shop link (`slugs/{slug}`) and the storefront;
2. orders and each order's buyer contact (`storefronts/{uid}/orders/**`);
3. Shopee import history (`catalogueIngestions/{uid}/jobs/**`);
4. the books (`users/{uid}/sales`, `purchases`, `expenses`, `customers`, `inventory`, `transactions`, `meta`) and the profile;
5. the sign-in account itself.

Every step can be repeated. If the connection drops halfway, running it again finishes the job.

What stays:

- `entitlements/{uid}` (trial start and `paidUntil`). Clients cannot delete it, and keeping it stops the free trial from being restarted. Signing in again with the same Google account creates a new user ID, so this record is only reachable by the operator. Delete it from the Firebase console if an owner asks for full erasure.
- `catalogueIngestionLocks/quota_{uid}` and `links_{uid}`: import counters with no personal content.

### Rules this needs

`firebase/firestore.rules` in this release adds three permissions, all limited to the owner:

- delete an order, and delete its `contact/buyer`, **only when the storefront no longer exists**. While a shop exists its orders still cannot be deleted, so buyers' tracking links keep working as before;
- delete their own import jobs and drafts (creating and updating them stays server-only).

Publish these rules **before** activating the frontend that has the button. With the older rules the deletion stops at step 2 with a permission error: the shop is already closed and removed, the books and the account are untouched, and the owner sees "Penghapusan belum selesai". After the rules are published, pressing the button again completes it.

### Tests

- `tests/catalog/rules.mjs`: who may delete orders, contacts and import history, and when.
- `tests/integration/account-delete.spec.mjs`: a real owner with a shop, products and a buyer order is deleted against the emulators; every collection is checked empty, the trial record stays, the shop link closes, and signing in again starts a new empty account.
- `tests/e2e/landing.spec.mjs`: the confirmation dialog, the landing and legal pages, the in-app browser notice, the platform credit.
- `scripts/check-launch.mjs`: in-app browser detection, preview tags and picture size, robots and sitemap.
