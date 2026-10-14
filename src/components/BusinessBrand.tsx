import { useEffect } from "react";
import { Building2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getAccent, isBusinessLogo } from "@/lib/branding";

export function BusinessTheme() {
  const { user } = useAuth();
  useEffect(() => {
    const root = document.documentElement;
    const accent = getAccent(user?.businessAccent);
    root.style.setProperty("--brand", accent.color);
    root.style.setProperty("--brand-dark", accent.darkColor);
    document.title = user?.businessName?.trim() ? `${user.businessName} · Ruang Usaha` : "Ruang Usaha";
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-dark");
    };
  }, [user?.businessAccent, user?.businessName]);
  return null;
}

export function BusinessBrand({ name, logo }: { name?: string; logo?: string }) {
  return <div className="flex min-w-0 items-center gap-3">
    <Avatar className="h-11 w-11 shrink-0 rounded-xl border bg-card">
      {isBusinessLogo(logo) && <AvatarImage src={logo} alt="" className="object-contain p-1" />}
      <AvatarFallback className="rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></AvatarFallback>
    </Avatar>
    <div className="min-w-0"><p className="truncate font-semibold tracking-tight">{name?.trim() || "Ruang Usaha"}</p>
      <p className="text-xs text-muted-foreground">Ruang kerja bisnis</p></div>
  </div>;
}
