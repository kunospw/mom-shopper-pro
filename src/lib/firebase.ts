import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { app } from "./firebase-app";
export { db } from "./firebase-app";
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export default app;
