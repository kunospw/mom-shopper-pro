export async function catalogueToken() {
  const { auth } = await import("./firebase");
  if (!auth.currentUser) throw new Error("Masuk untuk melanjutkan.");
  return auth.currentUser.getIdToken();
}
