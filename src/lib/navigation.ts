export const workspaceSections = [
  { id: "overview", path: "/", label: "Beranda", group: "main" },
  { id: "orders", path: "/orders", label: "Pesanan", group: "main" },
  { id: "sales", path: "/sales", label: "Penjualan", group: "main" },
  { id: "customers", path: "/customers", label: "Pelanggan", group: "main" },
  { id: "catalog", path: "/catalog", label: "Katalog", group: "business" },
  { id: "costs", path: "/costs", label: "Pembelian & biaya", group: "business" },
  { id: "reports", path: "/reports", label: "Laporan", group: "business" },
  { id: "settings", path: "/settings", label: "Pengaturan", group: "account" },
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
