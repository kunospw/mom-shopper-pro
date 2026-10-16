import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CircleAlert,
  Copy,
  FileText,
  Inbox,
  Info,
  Loader2,
  Lock,
  MessageCircle,
  Receipt,
  ShoppingBag,
  TriangleAlert,
  UserRoundPlus,
  Users,
  House,
} from "lucide-react";
import { PLATFORM_NAME, accents } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type State = "idle" | "loading" | "failed" | "blocked";

/** Google "G" mark, drawn inline so the button needs no external image. */
function GoogleMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-4 w-4">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.5 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  );
}

function Brand({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("flex items-center justify-center bg-white text-primary", size === "md" ? "h-[38px] w-[38px] rounded-[11px]" : "h-8 w-8 rounded-[9px]")}>
        <ShoppingBag className={size === "md" ? "h-5 w-5" : "h-[17px] w-[17px]"} aria-hidden="true" />
      </span>
      <span className={cn("font-bold tracking-tight", size === "md" ? "text-lg" : "text-[15px]")}>{PLATFORM_NAME}</span>
    </div>
  );
}

/** Decorative product collage on the desktop brand panel (not real data). */
function Collage() {
  const bars = [[48, 20], [56, 24], [52, 21], [70, 28], [78, 31], [96, 37]];
  return (
    <div aria-hidden="true" className="relative mt-10 flex-1">
      <div className="absolute left-0 top-2.5 grid w-[540px] max-w-full grid-cols-[118px_1fr] overflow-hidden rounded-[14px] bg-background text-foreground shadow-[0_30px_60px_-20px_rgba(10,30,20,0.55)]">
        <div className="flex flex-col gap-1 border-r border-border bg-white px-2.5 py-3.5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-clay text-[9px] font-bold text-white">S</span>
            <span className="text-[9px] font-bold">Toko Bu Sari</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-[5px] bg-[#E9F0E7] px-1.5 py-[5px] text-[8.5px] font-semibold text-primary"><House className="h-2.5 w-2.5" />Beranda</span>
          {[[Inbox, "Pesanan"], [Receipt, "Penjualan"], [Users, "Pelanggan"], [ShoppingBag, "Katalog"], [BarChart3, "Laporan"]].map(([Icon, label]) => {
            const I = Icon as typeof Inbox;
            return (
              <span key={label as string} className="flex items-center gap-1.5 px-1.5 py-[5px] text-[8.5px] text-muted-foreground">
                <I className="h-2.5 w-2.5" />
                {label as string}
                {label === "Pesanan" && <span className="ml-auto rounded-full bg-primary px-1 text-[7px] text-white">3</span>}
              </span>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5 p-3.5">
          <p className="text-xs font-bold">Halo, Bu Sari</p>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
            <div className="rounded-[9px] bg-white p-2.5">
              <p className="text-[7.5px] text-muted-foreground">Total penjualan</p>
              <p className="mt-0.5 text-[13px] font-bold">Rp 18.450.000</p>
              <div className="mt-1.5 flex h-1 overflow-hidden rounded"><span className="w-[77%] bg-primary" /><span className="flex-1 bg-clay" /></div>
            </div>
            <div className="rounded-[9px] bg-white p-2.5"><p className="text-[7.5px] text-muted-foreground">Diterima</p><p className="mt-0.5 text-[11px] font-bold">Rp 14,2 jt</p></div>
            <div className="rounded-[9px] bg-white p-2.5"><p className="text-[7.5px] text-muted-foreground">Untung bersih</p><p className="mt-0.5 text-[11px] font-bold">Rp 6,9 jt</p></div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[9px] bg-white p-2.5">
            <p className="text-[8.5px] font-semibold">Penjualan &amp; keuntungan</p>
            <div className="flex h-[78px] items-end gap-2.5 border-b border-border px-1">
              {bars.map(([a, b], i) => (
                <div key={i} className="flex h-full flex-1 items-end gap-0.5">
                  <span className={cn("flex-1 rounded-t-[3px]", i === 5 ? "bg-[#819579]" : "bg-[#A3B8A0]")} style={{ height: `${a}%` }} />
                  <span className={cn("flex-1 rounded-t-[3px]", i === 5 ? "bg-[#234535]" : "bg-primary")} style={{ height: `${b}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[9px] bg-white p-2.5 text-[8px]">
            <p className="text-[8.5px] font-semibold">Perlu tindakan</p>
            <p className="flex justify-between"><span>Rini Susanti · INV-2610-039</span><span className="rounded-full bg-warning-soft px-1.5 text-warning">DP</span></p>
            <p className="flex justify-between"><span>Maya Kusuma · INV-2610-041</span><span className="rounded border border-[#B9CDE0] px-1 text-info">Dikemas</span></p>
          </div>
        </div>
      </div>
      <div className="absolute -top-[18px] right-5 hidden h-[420px] w-[206px] flex-col overflow-hidden rounded-[28px] border-[6px] border-[#1B2A22] bg-[#FFFDF9] text-foreground shadow-[0_30px_60px_-16px_rgba(10,30,20,0.6)] xl:flex">
        <div className="flex h-[62px] items-center gap-2 bg-[#F3E7DC] px-3 pt-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay text-xs font-bold text-white">S</span>
          <div><p className="text-[10px] font-bold">Toko Bu Sari</p><p className="text-[7.5px] text-muted-foreground">Hijab, gamis &amp; camilan rumahan</p></div>
        </div>
        <div className="flex gap-1 px-2.5 py-2 text-[7.5px]">
          <span className="rounded-full bg-foreground px-[7px] py-[3px] font-semibold text-background">Semua</span>
          <span className="rounded-full border px-[7px] py-[3px]">Hijab</span>
          <span className="rounded-full border px-[7px] py-[3px]">Camilan</span>
        </div>
        <div className="grid grid-cols-2 gap-[7px] px-2.5">
          {[["Hijab Voal Paris", "Rp 45.000", "#EFE4D8"], ["Gamis Rayon", "Rp 189.000", "#E3EAE0"], ["Keripik Tempe", "Rp 28.000", "#EDE6DA"], ["E-book MPASI", "Rp 35.000", "#E6E3EE"]].map(([n, p, c]) => (
            <div key={n}><div className="h-[78px] rounded-[9px]" style={{ background: c }} /><p className="mt-1 text-[8px] font-semibold">{n}</p><p className="text-[8px] font-bold">{p}</p></div>
          ))}
        </div>
        <div className="mx-2.5 mb-3 mt-auto flex h-8 items-center justify-center gap-1 rounded-[10px] bg-request text-[9px] font-semibold text-white">
          <MessageCircle className="h-[11px] w-[11px]" />Kirim pesanan (3)
        </div>
      </div>
      <div className="absolute bottom-[30px] left-[300px] hidden w-[300px] items-center gap-3 rounded-[14px] bg-white px-3.5 py-3 text-foreground shadow-[0_20px_40px_-12px_rgba(10,30,20,0.5)] xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-request-soft text-request"><Inbox className="h-[18px] w-[18px]" /></span>
        <div className="flex-1"><p className="text-[12.5px] font-bold">Permintaan pesanan baru</p><p className="text-[11px] text-muted-foreground">#K7Q2MD · Ayu Lestari · Rp 263.000</p></div>
      </div>
    </div>
  );
}

export const Login = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from ? `${location.state.from.pathname}${location.state.from.search || ""}` : "/";

  // Signed-out screens use the platform accent, not any owner's color.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", accents.forest.color);
    root.style.setProperty("--brand-dark", accents.forest.darkColor);
    root.classList.remove("dark");
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-dark");
    };
  }, []);

  useEffect(() => {
    if (user && !loading) navigate(destination, { replace: true });
  }, [user, loading, navigate, destination]);

  async function signIn() {
    setState("loading");
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") setState("idle");
      else if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") setState("blocked");
      else setState("failed");
      return;
    }
  }
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* The address bar is still there to copy by hand. */
    }
  }

  if (loading)
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center bg-[#FAFAF7]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Memuat…</span>
      </div>
    );

  const busy = state === "loading";
  const panel = (mobile: boolean) => (
    <div className={cn("flex flex-col", mobile ? "gap-4" : "w-full max-w-[400px] gap-7")}>
      {!mobile && (
        <span className="flex h-[52px] w-[52px] items-center justify-center self-center rounded-[15px] bg-[#E9F0E7] text-primary">
          <ShoppingBag className="h-[26px] w-[26px]" aria-hidden="true" />
        </span>
      )}
      <div className={cn("flex flex-col gap-2", !mobile && "text-center")}>
        <h2 className={cn("font-bold tracking-tight", mobile ? "text-[22px]" : "text-[28px]")}>Selamat datang</h2>
        <p className={cn("leading-normal text-muted-foreground", mobile ? "text-[14.5px]" : "text-[15px]")}>
          {mobile ? "Masuk dengan akun Google untuk membuka catatan usaha Anda." : "Masuk ke ruang kerja usaha Anda dengan akun Google."}
        </p>
      </div>
      {state === "failed" && (
        <div role="alert" className="flex gap-2.5 rounded-xl bg-destructive-soft p-3.5 text-[13.5px] leading-normal text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span><strong>Belum berhasil masuk.</strong> Periksa koneksi internet Anda, lalu coba lagi. Data Anda tidak berubah.</span>
        </div>
      )}
      {state === "blocked" && (
        <div role="alert" className="flex gap-2.5 rounded-xl bg-warning-soft p-3.5 text-[13.5px] leading-normal text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span><strong>Jendela Google diblokir browser.</strong> Izinkan pop-up untuk situs ini, atau buka di Chrome/Safari jika Anda membuka dari WhatsApp.</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        aria-busy={busy}
        className={cn(
          "flex items-center justify-center gap-3 bg-primary font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(36,51,43,0.2)] transition-colors hover:bg-[#234535] disabled:opacity-80",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          mobile ? "h-[54px] rounded-[14px] text-base" : "h-[52px] rounded-xl text-[15px]",
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <GoogleMark />}
        {busy ? "Sedang masuk…" : state === "failed" ? "Coba lagi dengan Google" : "Masuk dengan Google"}
      </button>
      {busy && (
        <div role="status" className="flex gap-2.5 rounded-xl bg-info-soft p-3.5 text-[13.5px] leading-normal text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Pilih akun di jendela Google yang terbuka. Jangan tutup halaman ini.</span>
        </div>
      )}
      {state === "blocked" && (
        <button
          type="button"
          onClick={() => void copyAddress()}
          className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-input bg-white text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copied ? "Alamat disalin" : "Salin alamat halaman"}
        </button>
      )}
      {mobile ? (
        state === "idle" && (
          <p className="flex gap-2 text-[12.5px] leading-normal text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Akun baru dibuat otomatis. Catatan Anda tetap pribadi.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-3 rounded-[14px] bg-[#F2F4EE] p-4 text-[13px] leading-normal text-[#3D4A42]">
          <p className="flex gap-2.5"><UserRoundPlus className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Baru pertama kali? Akun dibuat otomatis saat Anda masuk.</p>
          <p className="flex gap-2.5"><Lock className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Catatan usaha hanya bisa dilihat oleh akun Anda. Pembeli hanya melihat katalog yang Anda buka.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#FAFAF7] text-foreground">
      {/* Desktop: brand panel + sign-in column */}
      <div className="hidden min-h-dvh grid-cols-[minmax(0,780px)_1fr] p-4 lg:grid">
        <section className="relative flex flex-col overflow-hidden rounded-2xl bg-primary px-[52px] py-11 text-white">
          <div aria-hidden="true" className="absolute -right-[180px] -top-[160px] h-[520px] w-[520px] rounded-full bg-[#376B51]" />
          <div aria-hidden="true" className="absolute -bottom-[220px] -left-[120px] h-[480px] w-[480px] rounded-full bg-[#2A5340]" />
          <div className="relative"><Brand /></div>
          <h1 className="relative mt-11 max-w-[560px] text-[44px] font-bold leading-[1.1] tracking-tight">Usaha kecil, kelola dengan lebih mudah.</h1>
          <p className="relative mt-4 max-w-[500px] text-[17px] leading-relaxed text-[#D7E4D9]">
            Catat penjualan, kelola pesanan, dan bagikan katalog usahamu dalam satu tempat.
          </p>
          <Collage />
          <ul className="relative mt-6 flex flex-wrap gap-7 border-t border-white/15 pt-[18px] text-[13px] text-[#D7E4D9]">
            <li className="flex items-center gap-2"><Receipt className="h-4 w-4 text-white" aria-hidden="true" />Catat penjualan &amp; DP</li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-white" aria-hidden="true" />Pesanan masuk lewat WhatsApp</li>
            <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-white" aria-hidden="true" />Invoice siap dibagikan</li>
          </ul>
        </section>
        <section className="flex flex-col px-10 py-8">
          <main className="flex flex-1 items-center justify-center">{panel(false)}</main>
          <footer className="flex justify-between text-[12.5px] text-muted-foreground">
            <span>© {new Date().getFullYear()} {PLATFORM_NAME}</span>
          </footer>
        </section>
      </div>

      {/* Mobile: green top, white sheet */}
      <div className="flex min-h-dvh flex-col bg-primary lg:hidden">
        <div className="flex flex-col gap-3.5 px-6 pt-14 text-white">
          <Brand size="sm" />
          <h1 className="mt-2.5 text-[30px] font-bold leading-[1.12] tracking-tight">Usaha kecil, kelola dengan lebih mudah.</h1>
          {state === "idle" && (
            <p className="text-[15px] leading-normal text-[#D7E4D9]">Catat penjualan, kelola pesanan, dan bagikan katalog usahamu dalam satu tempat.</p>
          )}
        </div>
        {state === "idle" ? (
          <div aria-hidden="true" className="relative mx-6 mb-6 mt-[22px] flex flex-col gap-2 rounded-2xl bg-white p-3.5 text-foreground shadow-[0_20px_40px_-14px_rgba(10,30,20,0.5)]">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total penjualan · Okt</span><span className="text-[11px] font-semibold text-success">↑ 12%</span></div>
            <p className="num text-[22px] font-bold">Rp 18.450.000</p>
            <div className="flex h-1.5 overflow-hidden rounded"><span className="w-[77%] bg-primary" /><span className="flex-1 bg-clay" /></div>
          </div>
        ) : (
          <div className="h-12" />
        )}
        <main className="mt-auto rounded-t-[28px] bg-[#FAFAF7] px-6 pb-10 pt-7">{panel(true)}</main>
      </div>
    </div>
  );
};
