import { useLayoutEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { PLATFORM_NAME, PLATFORM_TAGLINE, accents } from "@/lib/branding";
import { UPGRADE_WHATSAPP } from "@/lib/plan-config";

/** Signed-out platform pages (landing, legal) are always light and use the platform green. */
export function usePlatformPage(title: string) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = document.title;
    root.style.setProperty("--brand", accents.forest.color);
    root.style.setProperty("--brand-dark", accents.forest.darkColor);
    root.classList.remove("dark");
    document.title = title;
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-dark");
      document.title = previous;
    };
  }, [title]);
}

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** WhatsApp link to the operator, or null when no number is configured. */
export const contactLink = UPGRADE_WHATSAPP ? `https://wa.me/${UPGRADE_WHATSAPP}` : null;

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <Link to="/" className={`flex items-center gap-2.5 rounded-lg ${focus}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
          <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight">{PLATFORM_NAME}</span>
          <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">{PLATFORM_TAGLINE}</span>
        </span>
      </Link>
      <Link
        to="/login"
        className={`flex h-11 items-center rounded-xl border border-input bg-white px-4 text-sm font-semibold hover:bg-[#F2F4EE] ${focus}`}
      >
        Masuk
      </Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {PLATFORM_NAME}
        </span>
        <nav aria-label="Tautan kaki halaman" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privasi" className={`underline underline-offset-4 hover:text-foreground ${focus}`}>
            Kebijakan privasi
          </Link>
          <Link to="/ketentuan" className={`underline underline-offset-4 hover:text-foreground ${focus}`}>
            Syarat &amp; ketentuan
          </Link>
          {contactLink && (
            <a href={contactLink} target="_blank" rel="noreferrer" className={`underline underline-offset-4 hover:text-foreground ${focus}`}>
              Hubungi kami
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  usePlatformPage(title);
  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAF7] text-foreground">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
