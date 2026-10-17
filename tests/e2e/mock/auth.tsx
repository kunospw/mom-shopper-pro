import React, { createContext, useContext } from "react";
const user = { uid: "u1", email: "sari.wulandari@gmail.com", displayName: "Sari Wulandari", businessName: "Toko Melati", businessPhone: "6281200000", bankAccounts: [{ id: "1", bankName: "BCA", accountNumber: "123", accountHolder: "Melati" }], createdAt: new Date(), updatedAt: new Date() };
const Ctx = createContext<any>(null);
// ?auth=out shows the signed-out app; ?signin=fail|blocked|hang drives the login states.
const params = new URLSearchParams(location.search);
const signedOut = params.get("auth") === "out" || sessionStorage.getItem("__auth") === "out";
if (params.get("auth") === "out") sessionStorage.setItem("__auth", "out");
const mode = params.get("signin");
async function signInWithGoogle() {
  await new Promise((r) => setTimeout(r, 300));
  if (mode === "fail") throw Object.assign(new Error("net"), { code: "auth/network-request-failed" });
  if (mode === "blocked") throw Object.assign(new Error("blocked"), { code: "auth/popup-blocked" });
  if (mode === "closed") throw Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" });
  await new Promise(() => {});
}
export const AuthProvider = ({ children }: any) => (
  <Ctx.Provider value={{ user: signedOut ? null : user, loading: false, signInWithGoogle, signOut: async () => {}, updateUserProfile: async (p: any) => { const g = globalThis as any; g.__patches = [...(g.__patches || []), p]; } }}>{children}</Ctx.Provider>
);
export const useAuth = () => useContext(Ctx);
