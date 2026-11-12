import type { ReactNode } from "react";
import { PLATFORM_NAME } from "@/lib/branding";
import { PLAN_PRICE_IDR } from "@/lib/plan-config";
import { TRIAL_DAYS } from "@/lib/entitlement";
import { PublicPage, contactLink } from "@/components/PublicPage";

/**
 * Privacy policy and terms. Plain-language drafts that describe what the app
 * does today; update both (and UPDATED) whenever data handling changes.
 * They are not a substitute for legal review.
 */
const UPDATED = "12 November 2026";

function Document({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <PublicPage title={`${title} · ${PLATFORM_NAME}`}>
      <article className="mx-auto w-full max-w-3xl px-5 pb-14 pt-6">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Berlaku sejak {UPDATED}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-[#3D4A42]">{intro}</p>
        <div className="mt-2 flex flex-col">{children}</div>
      </article>
    </PublicPage>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2.5 flex flex-col gap-2.5 text-[15px] leading-relaxed text-[#3D4A42] [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

function Contact() {
  return contactLink ? (
    <p>
      Hubungi pengelola {PLATFORM_NAME} lewat{" "}
      <a href={contactLink} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">
        WhatsApp
      </a>
      .
    </p>
  ) : (
    <p>Hubungi pengelola {PLATFORM_NAME} lewat kontak yang tertera di aplikasi.</p>
  );
}

export function Privacy() {
  return (
    <Document
      title="Kebijakan privasi"
      intro={`Halaman ini menjelaskan data apa yang disimpan ${PLATFORM_NAME}, untuk apa, siapa yang bisa melihatnya, dan cara menghapusnya. Kami menulisnya sesingkat dan sejelas mungkin.`}
    >
      <Section title="1. Data penjual">
        <p>Saat Anda masuk dengan Google, kami menyimpan:</p>
        <ul>
          <li>nama, alamat email, dan foto profil dari akun Google Anda;</li>
          <li>informasi usaha yang Anda isi: nama usaha, alamat, nomor telepon, logo, rekening bank, dan gambar QRIS;</li>
          <li>catatan usaha Anda: penjualan, pembayaran, pelanggan, stok, pembelian, dan biaya;</li>
          <li>isi toko online Anda: nama toko, nomor WhatsApp, produk, foto, dan harga;</li>
          <li>status langganan: tanggal mulai uji coba dan tanggal akhir paket.</li>
        </ul>
        <p>Kami tidak menerima dan tidak menyimpan kata sandi Google Anda.</p>
      </Section>

      <Section title="2. Data pembeli">
        <p>Saat pembeli mengirim pesanan dari toko online, kami menyimpan nama pembeli, isi pesanan, catatan untuk penjual, nomor WhatsApp, serta alamat dan pilihan pembayaran jika diisi.</p>
        <ul>
          <li>Nomor WhatsApp dan alamat pembeli hanya bisa dibaca oleh penjual toko tersebut.</li>
          <li>Halaman lacak pesanan bisa dibuka oleh siapa pun yang memegang link pesanan. Halaman itu menampilkan nama pembeli dan isi pesanan, tetapi tidak menampilkan nomor WhatsApp atau alamat.</li>
          <li>Penjual bertanggung jawab memakai data pembeli hanya untuk mengurus pesanan.</li>
        </ul>
      </Section>

      <Section title="3. Untuk apa data dipakai">
        <ul>
          <li>Menjalankan fitur aplikasi: toko online, pesanan, catatan usaha, laporan, dan invoice.</li>
          <li>Mengurus langganan dan menjawab pertanyaan Anda.</li>
          <li>Menjaga keamanan layanan dan mencegah penyalahgunaan.</li>
        </ul>
        <p>Kami tidak menjual data Anda dan tidak memasang iklan. Aplikasi ini tidak memakai pelacak iklan atau alat analitik pihak ketiga.</p>
      </Section>

      <Section title="4. Siapa yang bisa melihat data">
        <ul>
          <li>Catatan usaha hanya bisa dibaca oleh akun Anda sendiri.</li>
          <li>Toko dan produk yang Anda buka bisa dilihat siapa pun yang punya link toko.</li>
          <li>Pengelola {PLATFORM_NAME} dapat mengakses data seperlunya untuk memperbaiki masalah, mengaktifkan langganan, atau memenuhi kewajiban hukum.</li>
        </ul>
      </Section>

      <Section title="5. Pihak ketiga yang memproses data">
        <ul>
          <li>
            <strong>Google Firebase</strong> menyimpan akun dan seluruh data aplikasi di server Google.
          </li>
          <li>
            <strong>Google Fonts</strong> memuat huruf di halaman, sehingga Google menerima alamat IP perangkat Anda.
          </li>
          <li>
            <strong>Ollama Cloud</strong> dipakai hanya jika penjual menyalakan asisten toko. Pertanyaan pembeli dan isi katalog yang terbuka dikirim ke layanan ini untuk membuat jawaban. Percakapan asisten tidak kami simpan.
          </li>
          <li>
            <strong>Shopee</strong>: saat Anda mengimpor produk, server kami membuka tautan Shopee yang Anda bagikan untuk membaca nama, harga, dan foto produk.
          </li>
          <li>
            <strong>WhatsApp</strong>: pesanan dikirim lewat aplikasi WhatsApp di perangkat pembeli. Isi pesan itu tunduk pada kebijakan WhatsApp.
          </li>
        </ul>
        <p>Sebagian layanan di atas berada di luar Indonesia.</p>
      </Section>

      <Section title="6. Penyimpanan di perangkat">
        <p>Aplikasi menyimpan sesi masuk, pengaturan tampilan, dan salinan halaman agar bisa dibuka saat sinyal lemah. Data ini tersimpan di browser Anda dan hilang jika Anda menghapus data situs.</p>
      </Section>

      <Section title="7. Berapa lama data disimpan">
        <p>Data disimpan selama akun Anda ada. Anda bisa menghapus akun kapan saja dari Pengaturan → Akun → Hapus akun. Penghapusan menghilangkan profil, catatan usaha, toko, produk, pesanan, dan data pembeli di toko Anda.</p>
        <p>Setelah akun dihapus, kami tetap menyimpan catatan tanggal uji coba, paket, dan penghitung kuota impor yang terikat pada kode akun, tanpa nama atau email, agar uji coba gratis tidak diulang.</p>
      </Section>

      <Section title="8. Hak Anda">
        <p>Anda berhak melihat, memperbaiki, dan menghapus data Anda. Sebagian besar bisa dilakukan sendiri di aplikasi. Pembeli yang ingin datanya dihapus dapat menghubungi penjual, atau menghubungi kami.</p>
      </Section>

      <Section title="9. Keamanan">
        <p>Semua koneksi memakai HTTPS. Aturan akses di server memastikan setiap penjual hanya bisa membaca datanya sendiri. Tidak ada sistem yang aman sepenuhnya, jadi jaga juga keamanan akun Google Anda.</p>
      </Section>

      <Section title="10. Perubahan dan kontak">
        <p>Jika kebijakan ini berubah, tanggal di atas diperbarui dan perubahan penting kami beri tahukan di aplikasi.</p>
        <Contact />
      </Section>
    </Document>
  );
}

export function Terms() {
  const price = PLAN_PRICE_IDR > 0 ? `Rp ${PLAN_PRICE_IDR.toLocaleString("id-ID")} per bulan` : "sesuai harga yang tertera di aplikasi";
  return (
    <Document
      title="Syarat & ketentuan"
      intro={`Dengan memakai ${PLATFORM_NAME}, Anda menyetujui ketentuan di bawah ini. Jika tidak setuju, mohon tidak memakai layanan ini.`}
    >
      <Section title="1. Layanan">
        <p>
          {PLATFORM_NAME} adalah alat bantu untuk penjual: toko online dengan pesanan lewat WhatsApp dan pencatatan usaha. {PLATFORM_NAME} bukan marketplace, bukan pihak dalam jual beli, dan tidak memegang uang pembeli atau penjual.
        </p>
      </Section>

      <Section title="2. Akun">
        <ul>
          <li>Anda masuk dengan akun Google dan bertanggung jawab atas keamanan akun itu.</li>
          <li>Isi data usaha dengan benar, terutama nomor WhatsApp dan informasi pembayaran.</li>
          <li>Satu akun dipakai untuk satu usaha.</li>
        </ul>
      </Section>

      <Section title="3. Kewajiban penjual">
        <ul>
          <li>Menjual hanya barang dan jasa yang sah menurut hukum Indonesia.</li>
          <li>Menulis nama, harga, foto, dan keterangan produk dengan jujur, serta hanya memakai foto dan teks yang berhak Anda pakai.</li>
          <li>Memenuhi pesanan, pengiriman, pengembalian, dan keluhan pembeli. Semua itu urusan antara penjual dan pembeli.</li>
          <li>Memakai data pembeli hanya untuk mengurus pesanan, bukan untuk dijual atau disebarkan.</li>
          <li>Mengurus sendiri pajak dan izin usaha yang berlaku.</li>
        </ul>
      </Section>

      <Section title="4. Paket dan pembayaran">
        <ul>
          <li>Pencatatan usaha gratis.</li>
          <li>
            Toko online gratis dicoba {TRIAL_DAYS} hari sejak toko pertama kali dibuka. Setelah itu toko online memerlukan paket berbayar, saat ini {price}.
          </li>
          <li>Pembayaran paket dilakukan lewat WhatsApp dengan pengelola, lalu paket diaktifkan secara manual.</li>
          <li>Jika paket berakhir, toko tertutup untuk pembeli baru. Catatan usaha dan halaman lacak pesanan tetap berjalan.</li>
          <li>Pembayaran yang sudah diterima tidak dikembalikan, kecuali layanan tidak bisa kami sediakan.</li>
          <li>Harga dapat berubah. Perubahan berlaku untuk periode berikutnya dan kami umumkan lebih dulu.</li>
        </ul>
      </Section>

      <Section title="5. Asisten toko dan impor produk">
        <p>Asisten toko menjawab pertanyaan pembeli secara otomatis dari isi katalog, dan impor produk membaca data dari tautan yang Anda bagikan. Hasil keduanya bisa keliru. Periksa hasil impor sebelum menyimpan, dan anggap jawaban asisten sebagai bantuan, bukan janji dari penjual.</p>
      </Section>

      <Section title="6. Larangan">
        <ul>
          <li>Memakai layanan untuk penipuan, barang terlarang, atau konten yang melanggar hukum.</li>
          <li>Mengganggu, membobol, atau membebani sistem secara tidak wajar.</li>
          <li>Membuat banyak akun untuk mengulang uji coba gratis.</li>
        </ul>
        <p>Kami dapat menutup toko atau akun yang melanggar ketentuan ini.</p>
      </Section>

      <Section title="7. Ketersediaan dan tanggung jawab">
        <p>Layanan disediakan apa adanya. Kami berusaha menjaga layanan tetap berjalan dan data tetap aman, tetapi tidak menjamin layanan bebas gangguan. Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian dari transaksi antara penjual dan pembeli, atau dari gangguan layanan.</p>
        <p>Laporan di aplikasi dihitung dari data yang Anda masukkan dan bukan nasihat keuangan atau pajak.</p>
      </Section>

      <Section title="8. Berhenti memakai layanan">
        <p>Anda bisa berhenti kapan saja dan menghapus akun dari Pengaturan → Akun. Data yang dihapus tidak bisa dikembalikan.</p>
      </Section>

      <Section title="9. Hukum dan perubahan">
        <p>Ketentuan ini tunduk pada hukum Republik Indonesia. Ketentuan dapat berubah, tanggal di atas diperbarui, dan perubahan penting kami beri tahukan di aplikasi.</p>
        <Contact />
      </Section>
    </Document>
  );
}
