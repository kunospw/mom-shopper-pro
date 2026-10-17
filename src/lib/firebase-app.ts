import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

/**
 * Local test runs only (`VITE_FIREBASE_EMULATOR=1`, see tests/README.md): talk to
 * the Firebase emulators instead of a real project. Refuses anything but a
 * `demo-` project id, which Firebase never connects to real services.
 */
export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === "1";
if (useEmulator && !String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "").startsWith("demo-"))
  throw new Error("VITE_FIREBASE_EMULATOR needs a demo- project id (never a real project).");

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const db = getFirestore(app);
if (useEmulator) connectFirestoreEmulator(db, "127.0.0.1", Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8088));
