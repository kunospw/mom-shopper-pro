# LarisKu

*Dari rumah, laris ke mana-mana.*

A WhatsApp-first shop and bookkeeping app for small resellers, built with React, TypeScript, Vite and Firebase. Sellers get a branded online catalog whose orders arrive on WhatsApp, and a workspace to record sales, payments, stock and costs with honest profit reports. The interface is in Indonesian.

## Features

- **Toko online**: a shop link (`/shop/nama-toko`) with photos, options with their own prices, ready/preorder/digital products, and a cart that sends the order to the seller's WhatsApp. Buyers get a status page that keeps working even if the shop closes. Guided setup for new sellers.
- **Pesanan**: incoming order requests to confirm (into a sale) or reject with a reason the buyer sees.
- **Penjualan**: sales with DP and partial payments, refunds, shipping and discounts, fulfillment steps with courier and resi, physical and digital goods, invoices as PDF or image.
- **Pelanggan**: purchase history and what each customer still owes, with WhatsApp reminders.
- **Katalog**: products with cost and optional automatic stock, show/hide per product.
- **Pembelian & biaya**: stock purchases (adding to stock) and business costs.
- **Laporan**: sales, cost of goods, costs and net profit per period, with the full breakdown. See [accounting rules](docs/accounting.md) and the [bookkeeping model](docs/bookkeeping.md).
- **Promosi**: WhatsApp broadcast and status text, story and post images, shop and product links.
- **Langganan**: 7-day free trial for the online shop, paid plan via WhatsApp; bookkeeping stays free. See [plan and trial](docs/subscription.md).
- **Installable app (PWA)**: add to the home screen (Android, iPhone, desktop), opens offline to the last screen, home-screen shortcuts, update notice on new versions.
- **New-order alerts**: sound, pop-up and a system notification when a buyer sends an order, while the app is open or in the background (works on Firebase's free plan; alerts while the app is fully closed would need a push server).
- Light and dark mode, larger text option, phone and desktop layouts.

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd reseller-manager-app

# Install dependencies
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Authentication and add Google as a sign-in provider
4. Enable Firestore Database
5. Get your Firebase configuration

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_PLAN_PRICE_IDR=49000            # plan price on the upgrade screen
   VITE_UPGRADE_WHATSAPP=6281298590798  # WhatsApp for upgrades
   VITE_GRACE_END=                      # same date as graceEnd() in firestore.rules
   ```

### 4. Firebase Security Rules

Review [firebase/firestore.rules](firebase/firestore.rules) and the [catalog activation procedure](docs/catalog-pilot.md) before publishing rules in Firebase Console. The proposed policy preserves each owner's profile and transaction access and adds anonymous reads of published catalogs. It removes the development catch-all that allowed every signed-in user to access every document.

Rules are not deployed by a Vercel build. The checked-in rules must be tested and explicitly published before buyer catalogs are usable. Do not retain a global `request.auth != null` catch-all alongside them: overlapping Firestore rules grant access if **any** matching allow condition succeeds.

**Note**: QRIS images are stored as base64 strings in Firestore, so Firebase Storage is not required.

### 5. Run the Application

```bash
npm run dev         # development server on port 8081
npm run typecheck   # TypeScript, app and tooling
npm run check       # unit checks: finance (3 time zones), catalog, design, contrast, status, plan, setup
npm run build       # production build
```

Tests (all local, never a real Firebase project): `npm test` runs typecheck, unit checks and the browser suite on a mocked app; `npm run test:integration` runs the real app against the Firebase emulators; `npm run test:rules` runs the security rules suites. The emulator suites need Java 21+. See [tests/README.md](tests/README.md) for details and the feature coverage table.

### 6. Releasing

Rules, environment variables and the client must go out in a set order. Follow the [release checklist](docs/release.md).

## Usage

1. **Sign in** with Google.
2. **Set up the shop**: Katalog → Buat toko (name, WhatsApp, colour), then add products.
3. **Share the link** from Beranda or Promosi; orders arrive in Pesanan and on WhatsApp.
4. **Record sales**, payments and shipping; send invoices and reminders on WhatsApp.
5. **Record purchases and costs**, and read the profit breakdown in Laporan.
6. **Settings**: business identity and bank/QRIS for invoices, appearance, plan.

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Backend**: Firebase (Auth, Firestore)
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router Dom
- **Charts**: Recharts
- **Images and PDF**: html2canvas, jsPDF
- **Notifications**: Sonner
