import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { app, useEmulator } from "./firebase-app";
export { db } from "./firebase-app";
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

if (useEmulator) {
  connectAuthEmulator(auth, `http://127.0.0.1:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099}`, { disableWarnings: true });
  // Test hook (emulator only): a Google sign-in without Google's popup page.
  // The Auth emulator accepts this unsigned token; real projects never would.
  Object.assign(globalThis, {
    __emulatorSignIn: (email: string, name: string) =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, name, email_verified: true }))),
    __emulatorIdToken: () => auth.currentUser?.getIdToken() ?? null,
  });
}
export default app;
