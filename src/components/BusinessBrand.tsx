import { useEffect } from "react";
import { Building2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { PLATFORM_NAME, getAccent, isBusinessLogo } from "@/lib/branding";

export function BusinessTheme() {
  const { user } = useAuth();
  useEffect(() => {
    const root = document.documentElement;
    document.title = user?.businessName?.trim() ? `${user.businessName} · ${PLATFORM_NAME}` : PLATFORM_NAME;
    // Signed out (login) screens set their own platform accent; do not override it.
    if (!user) return;
    const accent = getAccent(user.businessAccent);
    root.style.setProperty("--brand", accent.color);
    root.style.setProperty("--brand-dark", accent.darkColor);
    root.style.setProperty("--brand-soft", accent.soft);
    root.style.setProperty("--brand-ink", accent.ink);
    return () => {
      for (const name of ["--brand", "--brand-dark", "--brand-soft", "--brand-ink"]) root.style.removeProperty(name);
    };
  }, [user, user?.businessAccent, user?.businessName]);
  return null;
}

export function BusinessBrand({ name, logo, compact = false }: { name?: string; logo?: string; compact?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">
    <Avatar className={compact ? "h-9 w-9 shrink-0 rounded-lg border bg-card" : "h-10 w-10 shrink-0 rounded-xl border bg-card"}>
      {isBusinessLogo(logo) && <AvatarImage src={logo} alt="" className="object-contain p-1" />}
      <AvatarFallback className="rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></AvatarFallback>
    </Avatar>
    <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight">{name?.trim() || PLATFORM_NAME}</p>
      {!compact && <p className="text-xs text-muted-foreground">Ruang kerja bisnis</p>}</div>
  </div>;
}
