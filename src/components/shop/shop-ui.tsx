import { useLayoutEffect, type ReactNode } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { PLATFORM_NAME, getAccent, isBusinessLogo } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * Buyer pages are always light and use the shop's own accent (button, active
 * chip, prices), never the platform green. Sets the three accent variables the
 * `shop` Tailwind colors read.
 */
export function useShopTheme(accent: string | undefined, title: string) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = getAccent(accent);
    root.classList.remove("dark");
    root.style.removeProperty("font-size");
    root.style.colorScheme = "light";
    root.style.setProperty("--brand", theme.color);
    root.style.setProperty("--shop-soft", theme.soft);
    root.style.setProperty("--shop-ink", theme.ink);
    document.title = title;
    return () => {
      for (const name of ["--brand", "--shop-soft", "--shop-ink", "color-scheme"]) root.style.removeProperty(name);
    };
  }, [accent, title]);
}

/** Round shop avatar: the logo, or the first letter on clay with a white ring. */
export function ShopAvatar({ name, logo, size = 52, ring = true }: { name: string; logo?: string; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (isBusinessLogo(logo))
    return (
      <img
        src={logo}
        alt=""
        style={style}
        className={cn("shrink-0 rounded-full bg-card object-cover", ring && "border-[3px] border-white")}
      />
    );
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-clay font-bold text-white",
        ring && "border-[3px] border-white",
      )}
    >
      {(name.trim()[0] || "T").toUpperCase()}
    </span>
  );
}

/** The 390-wide phone column every buyer screen lives in; widens a little on tablets and desktop. */
export function BuyerPage({ children, className, tone = "page" }: { children: ReactNode; className?: string; tone?: "page" | "white" }) {
  return (
    <div className={cn("min-h-dvh", tone === "white" ? "bg-white" : "bg-[#FBFBF8]")}>
      <div className={cn("relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col", className)}>{children}</div>
    </div>
  );
}

/** White top bar with a round back button, as on "Pesanan saya". */
export function BuyerTopBar({ title, subtitle, onBack, backLabel = "Kembali" }: { title: string; subtitle?: string; onBack: () => void; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[#EEF1EC] bg-white px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}

/** Callout used on product pages and alerts: tinted box, icon, text. */
export function Callout({
  icon,
  tone,
  children,
  role,
  className,
}: {
  icon: ReactNode;
  tone: "info" | "warning" | "muted" | "danger";
  children: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const tones = {
    info: "bg-info-soft [&>svg]:text-info",
    warning: "bg-warning-soft text-[#5C3D07] [&>svg]:text-warning",
    muted: "bg-muted [&>svg]:text-muted-foreground",
    danger: "bg-destructive-soft text-[#5E1F19] [&>svg]:text-destructive",
  };
  return (
    <div role={role} className={cn("flex gap-3 rounded-[14px] p-3.5 text-[13.5px] leading-normal", tones[tone], className)}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** C5: the shop is closed or the link does not exist. */
export function ShopUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <BuyerPage>
      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 p-8 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-muted text-muted-foreground">
          <Store className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-[21px] font-bold">{title}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-[#3D4A42]">{body}</p>
        <p className="mt-3 text-xs text-muted-foreground">Ditenagai {PLATFORM_NAME}</p>
      </main>
    </BuyerPage>
  );
}

/** Flat focus ring shared by the custom buyer controls. */
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
