# Reseller Manager App

A modern reseller management application built with React, TypeScript, Vite, and Firebase. Features include Google authentication, user profile management with customizable business information, and professional invoicing with QRIS integration.

## Features

- 🔐 **Google Authentication** - Secure login with Firebase Auth
- 👤 **User Profile Management** - Customize business info, bank details, and QRIS
- 📄 **Professional Invoicing** - Generate invoices with business branding
- 💳 **Payment Integration** - Bank transfer details and QRIS code display
- 📱 **WhatsApp Sharing** - Share invoices directly via WhatsApp
- 📊 **Transaction Management** - Track sales, purchases, and payments
- 📈 **Monthly Reports** - View detailed sales analytics

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

Update your Firestore rules to allow authenticated users to manage their profiles:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

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
3. **Create Transactions**: Add sales and purchase transactions
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
