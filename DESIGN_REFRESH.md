# Seller workspace refresh

Branch: `feat/configurable-seller-design`.

The existing React 18, Tailwind 3 and shadcn/Radix components remain in use. No dependency, transaction schema, Firestore path, authorization rule or Firebase configuration changes are required by the UI refresh.

Business settings now optionally store `businessAccent` (`teal`, `blue`, or `violet`) and `businessLogo` on the existing user profile using the existing profile update function. Profiles without these fields use a teal accent and a business icon. The business name uses the existing field; an empty name displays “Ruang Usaha”. Branding applies after saving. Logo uploads are decoded in the browser and limited to PNG/JPEG/WebP up to 100 KB, stored as a bounded data URL, and removable. No image hosting service is added. Logos appear in the workspace and invoice. If deployed rules enforce an allowlist of profile fields, the new optional fields require a separately reviewed rule change before they can be saved; deployed rules were not inspected or modified.

Summary cards cover all dates. Recorded sales include unpaid sales, received payments include only sales marked Paid, pending amounts include only sales marked Pending, and purchase costs are quantity × base price. Legacy single-item selling prices remain supported. These labels do not claim automatic payment verification or net profit after expenses.

Validation:

```sh
npm run build
./node_modules/.bin/tsc -p tsconfig.app.json
./node_modules/.bin/tsc -p tsconfig.node.json
node scripts/check-design.mjs
npm run lint
```

The full lint command has existing repository violations; do not disable them to make validation pass. A temporary browser harness outside the repository aliases AuthContext and storage to synthetic data. Desktop and 390px mobile checks cover navigation, manual payment status, invoice opening, transaction creation/editing/deletion and report access, branding save/remove, invalid logo rejection, and sign-out theme reset. It blocks external requests and never connects to Firebase. This demonstrates UI behavior, not production Google sign-in or Firestore authorization. No production data or Firebase configuration was changed.

Reference patterns reviewed online: the official shadcn Card, Tabs and Field source in `shadcn-ui/ui`, under `apps/v4/registry/new-york-v4/ui/`. The live documentation site returned HTTP 403; current component source was accessible via raw.githubusercontent.com. The newer Tailwind 4 implementations were used as design references, not installed over this repository’s components.

The independent buyer storefront pilot, multi-tenant features, billing, automated payments and inventory synchronization are outside this branch.

## Reading preferences

Business settings include an independent “Kenyamanan membaca” section: Light, Dark, or Follow device; Standard, Large (112.5%), or Extra large (125%). Choices apply immediately without submitting the business-profile form. The default follows the device color scheme and uses standard text. Rem-based text, spacing and controls scale together while preserving the browser's base font preference. Reset restores these defaults. Reduced-motion preferences are respected.

These personal preferences are saved per account on the current browser/device under `ruang-usaha:appearance:{uid}`; signed-out preferences use a separate guest key. They do not sync between devices and are not written to Firestore or added to the business profile. Other tabs update automatically. Malformed or inaccessible storage falls back safely; if a write is denied the UI applies the setting and reports that it could not be saved. Account changes reload the appropriate preferences.

Dark appearance covers portals, toast notifications, status controls, reports, and charts, with brighter accent colors for readable dark surfaces. Invoice paper remains white with dark text when exported/shared. Browser validation with synthetic auth/data covers both explicit modes, live system changes, reload persistence, keyboard selection, per-account isolation, tab synchronization, denied storage, malformed settings, reset, light invoice paper, and 390px layouts at the largest text size. No production Firebase requests were made.

## Task-based navigation and grouped settings

Primary navigation now has four stable destinations: Ringkasan (`/`), Transaksi (`/transactions`), Laporan (`/reports`), and Pengaturan (`/settings`). Desktop uses a persistent sidebar; mobile shows all four destinations in a bottom bar. The overview presents actionable summaries, separate sales/purchase shortcuts, and pending payments. Paid/Pending are transaction filters, not competing top-level destinations. Filters and search live in the URL and survive returning from another workspace area. The current settings section is also remembered while navigating the app.

Settings are separate routes: `/settings/appearance`, `/settings/business`, `/settings/payments`, and `/settings/account`. Only one section is shown at a time; all section names remain discoverable. Appearance preferences continue applying immediately on this device. Business, payment and account forms have independent Save actions and field validation. Switching sections preserves drafts; saving one section only updates its own profile fields and preserves other drafts. Leaving with unsaved work or closing a dirty transaction form prompts for confirmation. Browser Back is protected too. The account section contains sign-out with a warning if there are unsaved settings. The legacy `/profile` URL redirects to business settings.

Sales and purchase entry open a focused modal, with a preselected type for overview shortcuts. Writes are awaited before closing or reporting success. Failed writes leave entered data available for retry. Delete confirmation remains visible after a failed delete. Labels and controls support keyboard navigation; skip navigation and route focus help assistive technology. Enlarged text layouts remain usable at 390px, including entry forms and reports. Invoice export and appearance behavior remain unchanged.

React Router's existing package now uses its data-router APIs to support navigation blocking. Vercel's SPA rewrite is declared in `vercel.json` so refreshed/bookmarked routes resolve to the app. No infrastructure or package dependencies were added; Firestore collections, transaction schema and production configuration were not changed. Production authorization and the existing localStorage transaction fallback remain separate concerns from this UI change.

Design intent: predictable destinations, clear hierarchy, familiar controls, focused tasks, progressive disclosure, immediate feedback and recovery from mistakes. Apple HIG navigation/settings pages were requested but returned HTTP 403 in this environment; these are general design principles, not a claim of Apple certification or a fetched guideline audit. Existing shadcn/Radix components remain the UI foundation.

Synthetic browser validation covers desktop/mobile navigation, direct routes and reloads, settings draft retention and independent saves, failed profile writes, transaction search and combined filter reset, failed transaction writes and deletes with retry, transaction creation/editing/deletion, unsaved browser-Back/close protection, large-text mobile layouts, the legacy URL, and return to the requested page after sign-in. All external requests were blocked. Build, TypeScript, focused lint and `node scripts/check-design.mjs` pass; full lint retains the same 11 existing errors and 10 warnings.
