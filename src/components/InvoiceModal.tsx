import { useRef } from "react";
import { Transaction } from "@/types/transaction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/currency";
import { Download, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface InvoiceModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal = ({ transaction, isOpen, onClose }: InvoiceModalProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!transaction || transaction.type !== "sale") return null;

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
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `invoice-${transaction.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Invoice berhasil diunduh");
    } catch (error) {
      toast.error("Gagal mengunduh invoice");
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

        const file = new File([blob], `invoice-${transaction.id}.png`, { type: "image/png" });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          navigator
            .share({
              files: [file],
              title: `Invoice - ${transaction.buyerName}`,
              text: `Invoice untuk ${transaction.buyerName}`,
            })
            .then(() => toast.success("Berhasil dibagikan"))
            .catch(() => toast.error("Gagal membagikan"));
        } else {
          const itemsList = transaction.items?.map(item => 
            `${item.productName} (${item.quantity}x) - ${formatRupiah(item.sellingPrice * item.quantity)}`
          ).join("\n") || "";
          
          const message = encodeURIComponent(
            `*INVOICE*\n\nPembeli: ${transaction.buyerName}\n\nProduk:\n${itemsList}\n\nTotal: ${formatRupiah(
              transaction.totalSellingPrice || 0
            )}\nStatus: ${transaction.paymentStatus === "Paid" ? "Lunas" : "Belum Lunas"}\n\nTerima kasih!`
          );
          window.open(`https://wa.me/?text=${message}`, "_blank");
        }
      });
    } catch (error) {
      toast.error("Gagal membagikan invoice");
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invoice</DialogTitle>
        </DialogHeader>

        <div ref={invoiceRef} className="bg-card p-6 rounded-lg space-y-4">
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
            <p className="text-sm text-muted-foreground mt-1">#{transaction.id}</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatDate(transaction.date)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Pembeli</p>
              <p className="font-medium">{transaction.buyerName}</p>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2">Produk</p>
              <div className="space-y-3">
                {transaction.items?.map((item, index) => (
                  <div key={index} className="text-sm space-y-1 pb-2 border-b last:border-b-0">
                    <div className="flex justify-between">
                      <span className="font-medium">{item.productName}</span>
                      <span className="text-muted-foreground">x{item.quantity}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Harga satuan:</span>
                      <span>{formatRupiah(item.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Subtotal:</span>
                      <span>{formatRupiah(item.sellingPrice * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metode Pembayaran</span>
                <span className="font-medium">{transaction.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={`font-semibold ${
                    transaction.paymentStatus === "Paid" ? "text-success" : "text-pending"
                  }`}
                >
                  {transaction.paymentStatus === "Paid" ? "Lunas" : "Belum Lunas"}
                </span>
              </div>
            </div>

            {transaction.notes && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">Catatan</p>
                <p className="text-sm mt-1">{transaction.notes}</p>
              </div>
            )}

            {transaction.paymentMethod === "QRIS" && transaction.paymentStatus === "Pending" && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-2">Scan QRIS untuk Pembayaran</p>
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">[QRIS Code akan muncul di sini]</p>
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Bayar</span>
                <span className="font-bold text-lg text-primary">{formatRupiah(transaction.totalSellingPrice || 0)}</span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            Terima kasih atas pembelian Anda!
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={downloadInvoice} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Unduh PNG
          </Button>
          <Button onClick={shareToWhatsApp} variant="outline" className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Share WA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
