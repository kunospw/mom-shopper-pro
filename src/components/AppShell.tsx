import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  BarChart3,
  Settings,
  UserRound,
} from "lucide-react";
import { BusinessBrand } from "@/components/BusinessBrand";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { workspaceSections, workspaceSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
const icons = {
  overview: LayoutDashboard,
  transactions: List,
  reports: BarChart3,
  settings: Settings,
};

export function AppShell() {
  const { user } = useAuth();
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
          {workspaceSections.map((item) => {
            const Icon = icons[item.id];
            return (
              <NavLink
                key={item.id}
                to={destination(item)}
                end={item.path === "/"}
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
            <div className="min-w-0 md:hidden">
              <BusinessBrand
                name={user?.businessName}
                logo={user?.businessLogo}
              />
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
          className="mx-auto max-w-6xl space-y-6 px-4 py-6 outline-none sm:px-6 sm:py-8 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          <Outlet />
        </main>
      </div>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {workspaceSections.map((item) => {
          const Icon = icons[item.id];
          return (
            <NavLink
              key={item.id}
              to={destination(item)}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
