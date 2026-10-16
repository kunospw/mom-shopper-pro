export const workspaceSections = [
  { id: "overview", path: "/", label: "Ringkasan" },
  { id: "sales", path: "/sales", label: "Penjualan" },
  { id: "costs", path: "/costs", label: "Pembelian & biaya" },
  { id: "customers", path: "/customers", label: "Pelanggan" },
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
