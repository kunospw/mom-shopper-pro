# Reseller Manager App

A modern reseller management application built with React, TypeScript, Vite, and Firebase. Features include Google authentication, user profile management with customizable business information, and professional invoicing with QRIS integration.

## Features

- 🔐 **Google Authentication** - Secure login with Firebase Auth
- 👤 **User Profile Management** - Customize business info, bank details, and QRIS
- 📄 **Professional Invoicing** - Invoices with shipping, discount, payments made and balance due
- 💳 **Payment Integration** - Bank transfer details and QRIS code display
- 📱 **WhatsApp Sharing** - Share invoices directly via WhatsApp
- 📊 **Bookkeeping** - Sales with DP/partial payments, fulfillment and tracking numbers (physical and digital goods), customers, purchases, expenses, optional stock; see [bookkeeping model](docs/bookkeeping.md).
- 📈 **Monthly Reports** - View detailed sales analytics
- 🛍️ **Buyer Catalog Pilot** - Separate public listings and WhatsApp order requests; see [pilot setup and security prerequisites](docs/catalog-pilot.md).

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
   ```

### 4. Firebase Security Rules

Review [firebase/firestore.rules](firebase/firestore.rules) and the [catalog activation procedure](docs/catalog-pilot.md) before publishing rules in Firebase Console. The proposed policy preserves each owner's profile and transaction access and adds anonymous reads of published catalogs. It removes the development catch-all that allowed every signed-in user to access every document.

Rules are not deployed by a Vercel build. The checked-in rules must be tested and explicitly published before buyer catalogs are usable. Do not retain a global `request.auth != null` catch-all alongside them: overlapping Firestore rules grant access if **any** matching allow condition succeeds.

**Note**: QRIS images are stored as base64 strings in Firestore, so Firebase Storage is not required.

### 5. Run the Application

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Login**: Visit the app and sign in with your Google account
2. **Setup Profile**: Go to Profile page to add your business information:
   - Business name, address, and phone
   - Bank account details for transfers
   - Upload QRIS image for digital payments
3. **Record Sales**: Add sales with customer, items, DP and shipping; update payment and delivery as they happen
4. **Generate Invoices**: View and share professional invoices with your branding
5. **Track Performance**: Monitor your sales through monthly reports

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router Dom
- **Charts**: Recharts
- **Notifications**: Sonner
