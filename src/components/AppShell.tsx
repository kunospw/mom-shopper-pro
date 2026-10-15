import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  BarChart3,
  Settings,
  UserRound,
  Menu,
  ShoppingBag,
} from "lucide-react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { workspaceSections, workspaceSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
const icons = {
  overview: LayoutDashboard,
  transactions: List,
  reports: BarChart3,
  catalog: ShoppingBag,
  settings: Settings,
};

export function AppShell() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuNavigation = useRef(false);
  const { pathname, search } = useLocation();
  const activeSection = workspaceSection(pathname);
  const remembered = useRef<Record<string, string>>({
    settings: "/settings/appearance",
  });
  const retainedParams = new URLSearchParams(search);
  retainedParams.delete("new");
  retainedParams.delete("edit");
  const currentDestination = `${pathname}${retainedParams.size ? `?${retainedParams}` : ""}`;
  useEffect(() => {
    remembered.current[activeSection.id] = currentDestination;
  }, [activeSection.id, currentDestination]);
  const destination = (item: (typeof workspaceSections)[number]) =>
    item.id === activeSection.id
      ? currentDestination
      : remembered.current[item.id] || item.path;
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  function navigationLinks(onNavigate?: () => void) {
    return (
      <>
        {workspaceSections.map((item) => {
          const Icon = icons[item.id];
          return (
            <NavLink
              key={item.id}
              to={destination(item)}
              end={item.path === "/"}
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                )
                  onNavigate?.();
              }}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </>
    );
  }
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Langsung ke konten
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r bg-card px-4 py-6 md:flex md:flex-col">
        <BusinessBrand name={user?.businessName} logo={user?.businessLogo} />
        <nav aria-label="Navigasi utama" className="mt-8 space-y-1">
          {navigationLinks()}
        </nav>
        <div className="mt-auto border-t pt-4">
          <p className="truncate text-sm font-medium">{user?.displayName}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>
      </aside>
      <div className="md:pl-56">
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                closeLabel="Tutup menu"
                className="flex h-dvh w-[85vw] max-w-80 flex-col gap-6 overflow-y-auto bg-card p-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
                onCloseAutoFocus={(event) => {
                  if (menuNavigation.current) {
                    event.preventDefault();
                    menuNavigation.current = false;
                    requestAnimationFrame(() => {
                      if (!document.querySelector('[role="alertdialog"]'))
                        document
                          .getElementById("main-content")
                          ?.focus({ preventScroll: true });
                    });
                  }
                }}
              >
                <SheetHeader className="pr-10 text-left">
                  <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
                  <SheetDescription className="sr-only">
                    Pilih area kerja. Halaman yang sedang dibuka ditandai.
                  </SheetDescription>
                  <BusinessBrand
                    name={user?.businessName}
                    logo={user?.businessLogo}
                  />
                </SheetHeader>
                <nav aria-label="Navigasi utama" className="space-y-1">
                  {navigationLinks(() => {
                    menuNavigation.current = true;
                    setMenuOpen(false);
                  })}
                </nav>
                <div className="mt-auto border-t pt-4">
                  <p className="truncate text-sm font-medium">
                    {user?.displayName}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 md:hidden">
              <p className="truncate text-sm font-medium">
                {user?.businessName?.trim() || "Ruang Usaha"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeSection.label}
              </p>
            </div>
            <p className="hidden text-sm text-muted-foreground md:block">
              {workspaceSection(pathname).label}
            </p>
            <Button asChild variant="ghost" size="icon">
              <NavLink to="/settings/account" aria-label="Buka pengaturan akun">
                <UserRound className="h-5 w-5" />
              </NavLink>
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none sm:px-6 sm:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
