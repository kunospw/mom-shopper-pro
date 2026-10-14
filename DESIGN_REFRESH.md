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
