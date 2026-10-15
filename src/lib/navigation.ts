export const workspaceSections = [
  { id: "overview", path: "/", label: "Ringkasan" },
  { id: "transactions", path: "/transactions", label: "Transaksi" },
  { id: "catalog", path: "/catalog", label: "Katalog" },
  { id: "reports", path: "/reports", label: "Laporan" },
  { id: "settings", path: "/settings", label: "Pengaturan" },
] as const;
export const settingsSections = [
  {
    id: "appearance",
    label: "Tampilan",
    description: "Mode layar dan kenyamanan membaca",
  },
  {
    id: "business",
    label: "Bisnis",
    description: "Identitas dan merek di invoice",
  },
  {
    id: "payments",
    label: "Pembayaran",
    description: "Rekening bank dan QRIS di invoice",
  },
  {
    id: "account",
    label: "Akun",
    description: "Profil pribadi dan akses akun",
  },
] as const;
export type SettingsSection = (typeof settingsSections)[number]["id"];
export function workspaceSection(path: string) {
  return (
    workspaceSections.find(
      (section) =>
        section.path !== "/" &&
        (path === section.path || path.startsWith(`${section.path}/`)),
    ) ?? workspaceSections[0]
  );
}
export function transactionFilters(params: URLSearchParams) {
  const status = params.get("status");
  const type = params.get("type");
  const month = params.get("month");
  return {
    status: status === "Paid" || status === "Pending" ? status : "all",
    type: type === "sale" || type === "stock" ? type : "all",
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") ? month : "all",
    q: params.get("q") || "",
  };
}
