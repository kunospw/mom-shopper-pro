import { useRef } from "react";
import type { Sale } from "@/types/books";
import { isRefund, paymentLabels } from "@/lib/books";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/currency";
import { Share2, Phone, MapPin, FileText } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { PLATFORM_NAME, getAccent, isBusinessLogo } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";

const methodLabels: Record<string, string> = { Transfer: "Transfer", QRIS: "QRIS", Cash: "Tunai", EWallet: "E-wallet" };

interface InvoiceModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal = ({ sale, isOpen, onClose }: InvoiceModalProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  if (!sale) return null;
  const buyerName = sale.customer.name || "Pelanggan";

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const downloadInvoice = async () => {
    if (!invoiceRef.current) return;

    try {
      // Capture the invoice as canvas with better settings for full content
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // Balanced resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        height: invoiceRef.current.scrollHeight, // Capture full height
        windowHeight: invoiceRef.current.scrollHeight, // Ensure full content is rendered
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // A4 dimensions
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 15; // Smaller margin for more content space
      const contentWidth = pdfWidth - (margin * 2);
      
      // Calculate image dimensions
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const imgData = canvas.toDataURL('image/png', 1.0); // Use PNG for better quality
      
      // If content is taller than one page, split it across multiple pages
      if (imgHeight > (pdfHeight - margin * 2)) {
        const pageHeight = pdfHeight - margin * 2;
        const totalPages = Math.ceil(imgHeight / pageHeight);
        
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }
          
          const sourceY = (i * pageHeight * canvas.height) / imgHeight;
          const sourceHeight = (pageHeight * canvas.height) / imgHeight;
          
          // Create a temporary canvas for this page
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          
          if (pageCtx) {
            pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
            const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
            pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageHeight);
          }
        }
      } else {
        // Single page - center vertically if smaller than page
        const yPosition = margin;
        pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      }

      // Add footer on the last page
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Dibuat dengan ${PLATFORM_NAME}`, margin, pdfHeight - 8);

      // Download PDF with readable filename
      const fileName = `Invoice-${buyerName.replace(/[^a-zA-Z0-9]/g, '')}-${sale.number}.pdf`;
      pdf.save(fileName);

      toast.success("Invoice PDF berhasil diunduh");
    } catch (error) {
      toast.error("Gagal mengunduh invoice PDF");
      console.error(error);
    }
  };

  const shareToWhatsApp = async () => {
    if (!invoiceRef.current) return;

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Gagal membuat gambar");
          return;
        }

        const file = new File([blob], `invoice-${sale.number}.png`, { type: "image/png" });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          navigator
            .share({
              files: [file],
              title: `Invoice - ${buyerName}`,
              text: `Invoice untuk ${buyerName}`,
            })
            .then(() => toast.success("Berhasil dibagikan"))
            .catch(() => toast.error("Gagal membagikan"));
        } else {
          const itemsList = sale.items.map(item => 
            `${item.name}${item.option ? ` (${item.option})` : ""} (${item.quantity}x) - ${formatRupiah(item.unitPrice * item.quantity)}`
          ).join("\n") || "";
          
          const businessHeader = user?.businessName ? `*${user.businessName}*\n` : "";
          const businessContact = user?.businessPhone ? `📞 ${user.businessPhone}\n` : "";
          const paymentInfo = user?.bankAccounts?.filter(account => account.bankName && account.accountNumber).length 
            ? `\n💳 *Pembayaran Transfer:*\n${user.bankAccounts
                .filter(account => account.bankName && account.accountNumber)
                .map(account => `Bank: ${account.bankName}\nNo. Rek: ${account.accountNumber}${account.accountHolder ? `\nA.n: ${account.accountHolder}` : ""}`)
                .join('\n\n')}`
            : "";
          
          const message = encodeURIComponent(
            `${businessHeader}${businessContact}\n*INVOICE ${sale.number}*\n\nPembeli: ${buyerName}\n\nProduk:\n${itemsList}\n\nTotal: ${formatRupiah(sale.total)}\nStatus: ${paymentLabels[sale.paymentState]}${sale.balance > 0 ? `\nSisa bayar: ${formatRupiah(sale.balance)}` : ""}${paymentInfo}\n\nTerima kasih!`
          );
          window.open(`https://wa.me/?text=${message}`, "_blank");
        }
      });
    } catch (error) {
      toast.error("Gagal membagikan invoice");
      console.error(error);
    }
  };

  const theme = getAccent(user?.businessAccent);
  const accent = `hsl(${theme.color})`;
  const banks = (user?.bankAccounts ?? []).filter((account) => account.bankName && account.accountNumber);
  const cancelled = sale.fulfillment.status === "cancelled";
  const due = cancelled ? 0 : sale.balance;
  const muted = "text-[#5E6A62]";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92dvh] w-full flex-col gap-4 p-4 sm:max-w-[560px] sm:p-6">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>Invoice {sale.number}</DialogTitle>
          <DialogDescription>Unduh sebagai PDF atau kirim gambar invoice ke pembeli.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-[#F4F5F0] p-2 sm:p-3">
          {/* Always light: this is what the buyer receives, in either app theme. */}
          <div ref={invoiceRef} className="invoice-paper space-y-5 rounded-lg bg-white p-5 text-[13px] text-[#24332B] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {isBusinessLogo(user?.businessLogo) && <img src={user.businessLogo} alt="Logo bisnis" className="h-12 w-12 shrink-0 rounded-lg object-contain" />}
                <div className="min-w-0">
                  <p className="text-base font-bold" style={{ color: accent }}>{user?.businessName || "Toko Anda"}</p>
                  {user?.businessAddress && <p className={`mt-0.5 flex gap-1 text-xs ${muted}`}><MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{user.businessAddress}</p>}
                  {user?.businessPhone && <p className={`flex items-center gap-1 text-xs ${muted}`}><Phone className="h-3 w-3 shrink-0" aria-hidden="true" />{user.businessPhone}</p>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tracking-wide" style={{ color: accent }}>INVOICE</p>
                <p className="font-mono text-xs">{sale.number}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-[#F4F5F0] p-3 text-xs">
              <div>
                <dt className={muted}>Tanggal</dt>
                <dd className="mt-0.5 font-semibold">{formatDate(sale.date)}</dd>
              </div>
              <div className="text-right">
                <dt className={muted}>Status</dt>
                <dd className="mt-0.5 font-semibold" style={{ color: cancelled ? "#A33A31" : sale.paymentState === "paid" ? "#1F6B40" : "#7F520A" }}>
                  {cancelled ? "Dibatalkan" : paymentLabels[sale.paymentState]}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className={muted}>Kepada</dt>
                <dd className="mt-0.5 font-semibold">{buyerName}</dd>
                {sale.customer.address && <dd className={`text-xs ${muted}`}>{sale.customer.address}</dd>}
              </div>
            </dl>

            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b text-left ${muted}`}>
                  <th scope="col" className="pb-2 font-medium">Produk</th>
                  <th scope="col" className="pb-2 text-right font-medium">Qty</th>
                  <th scope="col" className="pb-2 text-right font-medium">Harga</th>
                  <th scope="col" className="pb-2 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EAE2]">
                {sale.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 pr-2 align-top">
                      <span className="font-semibold">{item.name}</span>
                      {item.option && <span className={`block ${muted}`}>{item.option}</span>}
                    </td>
                    <td className="num py-2 text-right align-top">{item.quantity}</td>
                    <td className="num py-2 pl-2 text-right align-top">{formatRupiah(item.unitPrice)}</td>
                    <td className="num py-2 pl-2 text-right align-top font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="ml-auto max-w-[280px] space-y-1.5 text-xs">
              <div className="flex justify-between gap-4"><dt className={muted}>Subtotal</dt><dd className="num">{formatRupiah(sale.subtotal)}</dd></div>
              {sale.shipping > 0 && <div className="flex justify-between gap-4"><dt className={muted}>Ongkos kirim</dt><dd className="num">{formatRupiah(sale.shipping)}</dd></div>}
              {sale.discount > 0 && <div className="flex justify-between gap-4"><dt className={muted}>Diskon</dt><dd className="num">−{formatRupiah(sale.discount)}</dd></div>}
              <div className="flex justify-between gap-4 border-t pt-1.5 text-[13px] font-bold"><dt>Total</dt><dd className="num">{formatRupiah(sale.total)}</dd></div>
              {sale.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between gap-4">
                  <dt className={muted}>
                    {isRefund(payment) ? "Dikembalikan" : "Dibayar"} {new Date(payment.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {methodLabels[payment.method] ?? payment.method}
                  </dt>
                  <dd className="num">{isRefund(payment) ? "+" : "−"}{formatRupiah(payment.amount)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-[13px] font-bold" style={{ backgroundColor: `hsl(${theme.soft})`, color: `hsl(${theme.ink})` }}>
                <dt>{due > 0 ? "Sisa tagihan" : cancelled ? "Pesanan dibatalkan" : "Lunas"}</dt>
                <dd className="num">{formatRupiah(due)}</dd>
              </div>
            </dl>

            {sale.notes && (
              <div className="text-xs">
                <p className={`font-medium ${muted}`}>Catatan</p>
                <p className="mt-0.5 whitespace-pre-line">{sale.notes}</p>
              </div>
            )}

            {due > 0 && (banks.length > 0 || user?.qrisImageBase64) && (
              <div className="flex flex-wrap gap-4 border-t pt-4 text-xs">
                {banks.length > 0 && (
                  <div className="min-w-[180px] flex-1 space-y-2">
                    <p className="font-semibold">Transfer bank</p>
                    {banks.map((account, index) => (
                      <div key={account.id || index}>
                        <p className="font-medium">{account.bankName} · <span className="font-mono">{account.accountNumber}</span></p>
                        {account.accountHolder && <p className={muted}>a.n. {account.accountHolder}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {user?.qrisImageBase64 && (
                  <div className="text-center">
                    <p className="mb-1.5 font-semibold">QRIS</p>
                    <img src={user.qrisImageBase64} alt="Kode QRIS" className="h-28 w-28 rounded border object-cover" />
                  </div>
                )}
              </div>
            )}

            <p className={`border-t pt-4 text-center text-xs ${muted}`}>Terima kasih atas pembelian Anda!</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button onClick={() => void downloadInvoice()} className="h-11 flex-1 rounded-[10px]">
            <FileText />
            Unduh PDF
          </Button>
          <Button onClick={() => void shareToWhatsApp()} variant="outline" className="h-11 flex-1 rounded-[10px]">
            <Share2 />
            Kirim ke WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
