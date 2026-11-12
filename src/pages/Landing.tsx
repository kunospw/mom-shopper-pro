import { Link } from "react-router-dom";
import { BarChart3, Check, MessageCircle, Receipt, Share2, Store } from "lucide-react";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/branding";
import { PLAN_PRICE_IDR } from "@/lib/plan-config";
import { TRIAL_DAYS } from "@/lib/entitlement";
import { PublicPage, contactLink } from "@/components/PublicPage";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const primaryButton = `inline-flex h-[52px] items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-[#234535] ${focus}`;
const quietButton = `inline-flex h-[52px] items-center justify-center rounded-xl border border-input bg-white px-6 text-base font-semibold hover:bg-[#F2F4EE] ${focus}`;

/** Optional example shop (a slug), shown only when the operator sets it. */
const demoSlug = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(import.meta.env.VITE_DEMO_SHOP ?? "") ? String(import.meta.env.VITE_DEMO_SHOP) : null;
const price = PLAN_PRICE_IDR > 0 ? `Rp ${PLAN_PRICE_IDR.toLocaleString("id-ID")}` : null;

const benefits = [
  {
    Icon: Store,
    title: "Toko online dengan link sendiri",
    body: "Pasang foto, harga, dan pilihan ukuran. Pembeli memilih sendiri, lalu pesanannya masuk ke WhatsApp Anda dengan rapi.",
  },
  {
    Icon: Receipt,
    title: "Catatan jualan yang jujur",
    body: "Catat penjualan, DP, pelunasan, stok, dan biaya. Lihat untung bersih tiap bulan tanpa menghitung manual.",
  },
  {
    Icon: Share2,
    title: "Pindah dari Shopee dalam sekejap",
    body: "Bagikan produk dari aplikasi Shopee ke LarisKu. Nama, harga, dan foto terisi sendiri, tinggal Anda periksa.",
  },
];

const steps = [
  { title: "Masuk dengan Google", body: "Tanpa formulir panjang. Akun dibuat otomatis." },
  { title: "Isi toko dan produk", body: "Ikuti panduan singkat: nama toko, nomor WhatsApp, lalu produk pertama." },
  { title: "Bagikan link toko", body: "Kirim ke pelanggan, status WhatsApp, atau bio Instagram. Pesanan langsung masuk." },
];

const questions = [
  {
    q: "Apakah benar-benar gratis?",
    a: `Pencatatan penjualan, pembayaran, stok, biaya, dan laporan gratis selamanya. Toko online gratis dicoba ${TRIAL_DAYS} hari${price ? `, setelah itu ${price} per bulan` : ""}.`,
  },
  {
    q: "Apa yang terjadi kalau masa coba habis?",
    a: "Toko online tertutup untuk pembeli baru sampai Anda berlangganan. Catatan usaha tetap bisa dipakai, dan pembeli lama tetap bisa melacak pesanannya.",
  },
  {
    q: "Apakah pembeli harus mengunduh aplikasi?",
    a: "Tidak. Pembeli cukup membuka link toko Anda di browser, lalu mengirim pesanan lewat WhatsApp.",
  },
  {
    q: "Apakah LarisKu memotong hasil penjualan?",
    a: "Tidak. Pembayaran dari pembeli langsung ke rekening atau QRIS Anda. LarisKu tidak memegang uang Anda.",
  },
  {
    q: "Siapa yang bisa melihat catatan usaha saya?",
    a: "Hanya akun Anda. Pembeli hanya melihat katalog yang Anda buka. Anda bisa menghapus akun dan seluruh datanya kapan saja dari Pengaturan.",
  },
];

/** Shown at "/" to signed-out visitors (see ProtectedRoute). */
export default function Landing() {
  return (
    <PublicPage title={`${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`}>
      <section className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:pt-14">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E9F0E7] px-3 py-1.5 text-[13px] font-semibold text-primary">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Untuk penjual rumahan dan reseller
        </p>
        <h1 className="max-w-3xl text-[34px] font-bold leading-[1.12] tracking-tight sm:text-[48px]">
          Toko online lewat WhatsApp, plus catatan usaha yang rapi.
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[#3D4A42]">
          {PLATFORM_NAME} memberi Anda link toko sendiri dan buku catatan jualan dalam satu tempat. Pencatatan gratis selamanya.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link to="/login" className={primaryButton}>
            Mulai gratis
          </Link>
          {demoSlug && (
            <Link to={`/shop/${demoSlug}`} className={quietButton}>
              Lihat contoh toko
            </Link>
          )}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">Masuk dengan akun Google. Tanpa kartu kredit.</p>
      </section>

      <section aria-labelledby="benefits" className="mx-auto w-full max-w-5xl px-5 py-10">
        <h2 id="benefits" className="text-2xl font-bold tracking-tight">
          Yang Anda dapat
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {benefits.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-white p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9F0E7] text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#3D4A42]">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps" className="mx-auto w-full max-w-5xl px-5 py-10">
        <h2 id="steps" className="text-2xl font-bold tracking-tight">
          Mulai dalam tiga langkah
        </h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3.5 rounded-2xl bg-[#F2F4EE] p-5">
              <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#3D4A42]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pricing" className="mx-auto w-full max-w-5xl px-5 py-10">
        <h2 id="pricing" className="text-2xl font-bold tracking-tight">
          Harga
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              Catatan usaha
            </h3>
            <p className="num mt-3 text-[30px] font-bold tracking-tight">Gratis</p>
            <p className="text-sm text-muted-foreground">Selamanya</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[#3D4A42]">
              {["Penjualan, DP, dan pelunasan", "Stok, pembelian, dan biaya", "Laporan untung bersih", "Invoice PDF dan gambar"].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-primary bg-white p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Store className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              Toko online
            </h3>
            <p className="num mt-3 text-[30px] font-bold tracking-tight">
              {price ?? `Gratis ${TRIAL_DAYS} hari`}
              {price && <span className="text-base font-semibold text-muted-foreground"> / bulan</span>}
            </p>
            <p className="text-sm text-muted-foreground">{price ? `Gratis dicoba ${TRIAL_DAYS} hari` : "Tanpa kartu kredit"}</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[#3D4A42]">
              {["Link toko dengan nama Anda", "Pesanan masuk ke WhatsApp", "Halaman lacak pesanan untuk pembeli", "Bahan promosi siap bagikan"].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl px-5 py-10">
        <h2 id="faq" className="text-2xl font-bold tracking-tight">
          Pertanyaan yang sering muncul
        </h2>
        <dl className="mt-5 flex flex-col gap-3">
          {questions.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-border bg-white p-5">
              <dt className="text-base font-semibold">{q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-[#3D4A42]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-14 pt-6">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-primary p-7 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Siap mencoba?</h2>
            <p className="mt-1 text-sm text-[#D7E4D9]">Buat akun dalam satu menit. Ada pertanyaan? Chat kami lewat WhatsApp.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className={`inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-[15px] font-semibold text-primary hover:bg-[#F2F4EE] ${focus}`}>
              Mulai gratis
            </Link>
            {contactLink && (
              <a
                href={contactLink}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-12 items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 ${focus}`}
              >
                Tanya lewat WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
