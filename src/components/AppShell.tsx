import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Home,
  Link2,
  Inbox,
  Menu,
  PackagePlus,
  Plus,
  ReceiptText,
  Settings,
  Share2,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { WorkspaceSearch } from "@/components/WorkspaceSearch";
import { isBusinessLogo } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";
import { BooksProvider, useBooks } from "@/contexts/BooksContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { workspaceSections, workspaceSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { shopUrl } from "@/lib/shop-link";
import { toast } from "sonner";

type SectionId = (typeof workspaceSections)[number]["id"];
const icons: Record<SectionId, LucideIcon> = {
  overview: Home,
  orders: Inbox,
  sales: ReceiptText,
  customers: Users,
  catalog: ShoppingBag,
  costs: Wallet,
  reports: BarChart3,
  settings: Settings,
};
const groups = [
  { id: "main", label: "Harian" },
  { id: "business", label: "Usaha" },
] as const;

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} menunggu`}
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Shell() {
  const { user } = useAuth();
  const { pendingOrders, store } = useBooks();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const menuNavigation = useRef(false);
  const active = workspaceSection(pathname);
  const shopName = user?.businessName?.trim() || store?.name || "Toko saya";
  const initials =
    (user?.displayName || user?.email || "?")
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);

  const go = (path: string) => {
    setQuickOpen(false);
    setMenuOpen(false);
    navigate(path);
  };
  async function copyShopLink(share = false) {
    setQuickOpen(false);
    const url = shopUrl(store, user?.uid);
    try {
      if (share && navigator.share) await navigator.share({ title: store?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Tautan toko disalin. Tempel di grup atau status WhatsApp.");
      }
    } catch {
      /* Sharing was cancelled or clipboard denied; nothing was changed. */
    }
  }

  const link = (id: SectionId, onNavigate?: () => void) => {
    const item = workspaceSections.find((s) => s.id === id)!;
    const Icon = icons[id];
    return (
      <NavLink
        key={id}
        to={item.path}
        end={item.path === "/"}
        onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
            onNavigate?.();
        }}
        className={({ isActive }) =>
          cn(
            "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors hover:bg-accent md:min-h-10",
            isActive
              ? "bg-primary-soft font-semibold text-primary-ink hover:bg-primary-soft dark:bg-primary/15 dark:text-primary"
              : "text-foreground/85 hover:text-foreground",
          )
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {item.label}
        {id === "orders" && <Badge count={pendingOrders} />}
      </NavLink>
    );
  };

  const tab = (id: SectionId) => {
    const item = workspaceSections.find((s) => s.id === id)!;
    const Icon = icons[id];
    return (
      <NavLink
        key={id}
        to={item.path}
        end={item.path === "/"}
        className={({ isActive }) =>
          cn(
            "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
            isActive ? "text-primary" : "text-muted-foreground",
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                isActive && "bg-primary/10",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {id === "orders" && pendingOrders > 0 && (
                <span
                  aria-label={`${pendingOrders} menunggu`}
                  className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
                >
                  {pendingOrders > 9 ? "9+" : pendingOrders}
                </span>
              )}
            </span>
            {item.label}
          </>
        )}
      </NavLink>
    );
  };

  const quickActions = [
    { icon: ReceiptText, label: "Catat penjualan", hint: "Pesanan, DP, dan pengiriman", run: () => go("/sales?new=1") },
    { icon: Wallet, label: "Catat biaya", hint: "Ongkir, kemasan, iklan", run: () => go("/costs?new=expense") },
    { icon: PackagePlus, label: "Tambah produk", hint: "Foto, harga, dan stok", run: () => go("/catalog?new=product") },
    { icon: Share2, label: "Bagikan toko", hint: "Kirim tautan ke grup atau status", run: () => void copyShopLink(true) },
  ];

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Langsung ke konten
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card px-3.5 py-5 md:flex">
        <div className="flex items-center gap-3 px-1.5">
          {isBusinessLogo(user?.businessLogo) ? (
            <img src={user?.businessLogo} alt="" className="h-10 w-10 shrink-0 rounded-xl border bg-card object-contain p-0.5" />
          ) : (
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay text-base font-bold text-white">
              {(shopName[0] || "T").toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight">{shopName}</p>
            <p className="text-xs text-muted-foreground">Ruang usaha</p>
          </div>
        </div>
        <Button className="mt-5 h-11 justify-center rounded-[10px] text-sm" onClick={() => go("/sales?new=1")}>
          <Plus /> Catat penjualan
        </Button>
        <nav aria-label="Navigasi utama" className="mt-6 flex-1 space-y-5 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {group.label}
              </p>
              {workspaceSections
                .filter((s) => s.group === group.id)
                .map((s) => link(s.id))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t pt-3">
          <a
            href={shopUrl(store, user?.uid)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm text-foreground/85 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Store className="h-[18px] w-[18px]" aria-hidden="true" />
            Lihat toko saya
          </a>
          {link("settings")}
          <div className="mt-2 flex items-center gap-2.5 px-2 pt-2">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{user?.displayName || "Pemilik"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden items-center gap-3 bg-background/90 px-8 py-3.5 backdrop-blur md:flex">
          <WorkspaceSearch />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="h-11 rounded-[10px] bg-card" onClick={() => void copyShopLink()}>
              <Link2 /> Salin tautan toko
            </Button>
            <Button asChild variant="outline" size="icon" className="relative h-11 w-11 rounded-[10px] bg-card">
              <NavLink to="/orders" aria-label={pendingOrders ? `Pesanan, ${pendingOrders} menunggu` : "Pesanan"}>
                <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                {pendingOrders > 0 && <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-clay ring-2 ring-card" />}
              </NavLink>
            </Button>
          </div>
        </header>
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <BusinessBrand name={user?.businessName} logo={user?.businessLogo} compact />
            <Button asChild variant="ghost" size="icon">
              <NavLink to="/settings/account" aria-label="Buka pengaturan akun">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </NavLink>
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1280px] space-y-6 px-4 pb-32 pt-6 outline-none sm:px-6 md:px-8 md:pb-12 md:pt-2"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-md items-end px-2">
          {tab("overview")}
          {tab("orders")}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-label="Tambah cepat"
              onClick={() => setQuickOpen(true)}
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          {tab("sales")}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              ["customers", "catalog", "costs", "reports", "settings"].includes(active.id)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <span className="flex h-7 w-12 items-center justify-center">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </span>
            Lainnya
          </button>
        </div>
      </nav>

      {/* Quick add */}
      <Sheet open={quickOpen} onOpenChange={setQuickOpen}>
        <SheetContent side="bottom" closeLabel="Tutup" className="rounded-t-2xl pb-safe md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>Tambah cepat</SheetTitle>
            <SheetDescription>Pilih yang ingin Anda lakukan.</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 grid gap-2">
            {quickActions.map(({ icon: Icon, label, hint, run }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={run}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      {/* More menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          closeLabel="Tutup menu"
          className="rounded-t-2xl pb-safe md:hidden"
          onCloseAutoFocus={(event) => {
            if (menuNavigation.current) {
              event.preventDefault();
              menuNavigation.current = false;
              requestAnimationFrame(() =>
                document.getElementById("main-content")?.focus({ preventScroll: true }),
              );
            }
          }}
        >
          <SheetHeader className="text-left">
            <SheetTitle>Lainnya</SheetTitle>
            <SheetDescription>Katalog, pelanggan, biaya, laporan, dan pengaturan.</SheetDescription>
          </SheetHeader>
          <div className="mt-3 space-y-1">
            {(["customers", "catalog", "costs", "reports", "settings"] as const).map((id) =>
              link(id, () => {
                menuNavigation.current = true;
                setMenuOpen(false);
              }),
            )}
            <a
              href={shopUrl(store, user?.uid)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <Store className="h-[18px] w-[18px]" aria-hidden="true" />
              Lihat toko saya
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AppShell() {
  return (
    <BooksProvider>
      <Shell />
    </BooksProvider>
  );
}
