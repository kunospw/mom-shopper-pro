import { useState } from "react";
import {
  FileText,
  MessageCircle,
  Pencil,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatRupiah } from "@/lib/currency";
import {
  fulfillmentLabels,
  isAllDigital,
  newPayment,
  validatePayments,
  nextFulfillment,
  paymentLabels,
  whatsAppUpdateLink,
} from "@/lib/books";
import { useAuth } from "@/contexts/AuthContext";
import type { PaymentMethodV2, Sale } from "@/types/books";

export function SaleDetail({
  sale,
  onClose,
  onChange,
  onEdit,
  onDelete,
  onInvoice,
}: {
  sale: Sale | null;
  onClose: () => void;
  onChange: (next: Sale) => Promise<void>;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => Promise<void>;
  onInvoice: (sale: Sale) => void;
}) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodV2>("Transfer");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch {
      setError(fallback);
    } finally {
      setBusy(false);
    }
  }

  if (!sale)
    return (
      <Sheet open={false} onOpenChange={onClose}>
        <SheetContent />
      </Sheet>
    );
  const digital = isAllDigital(sale.items);
  const next = nextFulfillment(sale.fulfillment.status, digital);
  const cancelled = sale.fulfillment.status === "cancelled";
  const link = whatsAppUpdateLink(sale, user?.businessName);

  const withSale = (patch: Partial<Sale>) => ({ ...sale, ...patch }) as Sale;
  const addPayment = () => {
    const value = Math.round(Number(amount));
    if (!Number.isInteger(value) || value <= 0)
      return setError("Isi jumlah pembayaran.");
    const payments = [...sale.payments, newPayment(value, method, new Date().toISOString())];
    const [issue] = validatePayments(payments, { total: sale.total, cancelled: false });
    if (issue)
      return setError(
        issue.code === "overpaid"
          ? `Jumlah melebihi sisa tagihan ${formatRupiah(sale.balance)}.`
          : issue.message,
      );
    void run(async () => {
      await onChange(withSale({ payments }));
      setAmount("");
    }, "Pembayaran belum tersimpan. Coba lagi.");
  };
  const advance = () => {
    if (!next) return;
    void run(
      () =>
        onChange(
          withSale({
            fulfillment: {
              ...sale.fulfillment,
              status: next,
              courier: courier || sale.fulfillment.courier,
              trackingNo: tracking || sale.fulfillment.trackingNo,
              deliveryNote: note || sale.fulfillment.deliveryNote,
              updatedAt: new Date().toISOString(),
            },
          }),
        ),
      "Status belum berubah. Coba lagi.",
    );
  };
  const setStatus = (status: "cancelled" | "confirmed") =>
    run(
      () =>
        onChange(
          withSale({
            fulfillment: {
              ...sale.fulfillment,
              status,
              updatedAt: new Date().toISOString(),
            },
          }),
        ),
      "Status belum berubah. Coba lagi.",
    );

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle>
              {sale.number} · {sale.customer.name}
            </SheetTitle>
            <SheetDescription>
              {new Date(sale.date).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {sale.channel === "catalog" && " · dari katalog"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant={sale.paymentState === "paid" ? "success" : "warning"}>
                {paymentLabels[sale.paymentState]}
              </Badge>
              <Badge variant="neutral">
                {fulfillmentLabels[sale.fulfillment.status]}
              </Badge>
            </div>

            <section aria-labelledby="sd-items" className="space-y-2 text-sm">
              <h3 id="sd-items" className="font-semibold">Pesanan</h3>
              <ul className="space-y-1">
                {sale.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {item.name}
                      {item.option ? ` · ${item.option}` : ""} × {item.quantity}
                      {item.kind === "digital" && " (digital)"}
                    </span>
                    <span>{formatRupiah(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {sale.shipping > 0 && (
                <p className="flex justify-between text-muted-foreground">
                  <span>Ongkos kirim</span><span>{formatRupiah(sale.shipping)}</span>
                </p>
              )}
              {sale.discount > 0 && (
                <p className="flex justify-between text-muted-foreground">
                  <span>Diskon</span><span>-{formatRupiah(sale.discount)}</span>
                </p>
              )}
              <p className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span><span>{formatRupiah(sale.total)}</span>
              </p>
              <p className="flex justify-between text-muted-foreground">
                <span>Perkiraan untung</span><span>{formatRupiah(sale.profit)}</span>
              </p>
            </section>

            <section aria-labelledby="sd-pay" className="space-y-3 text-sm">
              <h3 id="sd-pay" className="font-semibold">Pembayaran</h3>
              {sale.payments.length === 0 ? (
                <p className="text-muted-foreground">Belum ada pembayaran.</p>
              ) : (
                <ul className="space-y-1">
                  {sale.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span>
                        {new Date(p.date).toLocaleDateString("id-ID")} · {p.method}
                      </span>
                      <span>{formatRupiah(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex justify-between font-medium">
                <span>Sisa tagihan</span><span>{formatRupiah(sale.balance)}</span>
              </p>
              {sale.balance > 0 && !cancelled && (
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="sd-amount">Catat pembayaran (Rp)</Label>
                    <Input
                      id="sd-amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <Button type="button" disabled={busy} onClick={addPayment}>
                    Simpan
                  </Button>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="sd-method">Metode</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethodV2)}>
                      <SelectTrigger id="sd-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="QRIS">QRIS</SelectItem>
                        <SelectItem value="EWallet">E-wallet</SelectItem>
                        <SelectItem value="Cash">Tunai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="col-span-2"
                    disabled={busy}
                    onClick={() => setAmount(String(sale.balance))}
                  >
                    Isi sisa tagihan ({formatRupiah(sale.balance)})
                  </Button>
                </div>
              )}
            </section>

            {!cancelled && (
              <section aria-labelledby="sd-ful" className="space-y-3 text-sm">
                <h3 id="sd-ful" className="font-semibold">Pengiriman</h3>
                {sale.fulfillment.trackingNo && (
                  <p>Resi {sale.fulfillment.courier}: {sale.fulfillment.trackingNo}</p>
                )}
                {sale.fulfillment.deliveryNote && (
                  <p className="whitespace-pre-wrap rounded bg-muted/50 p-2">
                    {sale.fulfillment.deliveryNote}
                  </p>
                )}
                {next && (
                  <>
                    {!digital && next === "shipped" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="sd-courier">Kurir</Label>
                          <Input id="sd-courier" value={courier} onChange={(e) => setCourier(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sd-resi">Nomor resi</Label>
                          <Input id="sd-resi" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                        </div>
                      </div>
                    )}
                    {digital && next === "delivered" && (
                      <div className="space-y-2">
                        <Label htmlFor="sd-note">Kode, akun, atau tautan untuk pembeli</Label>
                        <Textarea id="sd-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                        <p className="text-xs text-muted-foreground">
                          Hanya tersimpan di akun Anda. Kirim ke pembeli lewat WhatsApp.
                        </p>
                      </div>
                    )}
                    <Button type="button" disabled={busy} onClick={advance}>
                      Tandai {fulfillmentLabels[next].toLowerCase()}
                    </Button>
                  </>
                )}
              </section>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => onInvoice(sale)}>
                <FileText /> Invoice
              </Button>
              {link ? (
                <Button asChild variant="outline">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Kirim update via WhatsApp
                  </a>
                </Button>
              ) : (
                <p className="self-center text-xs text-muted-foreground">
                  Tambahkan nomor WhatsApp pelanggan untuk mengirim update.
                </p>
              )}
              {!cancelled && (
                <Button type="button" variant="outline" onClick={() => onEdit(sale)}>
                  <Pencil /> Ubah
                </Button>
              )}
              {cancelled ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => setStatus("confirmed")}>
                  <RotateCcw /> Buka kembali
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={busy} onClick={() => setStatus("cancelled")}>
                  <Ban /> Batalkan
                </Button>
              )}
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Hapus
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus penjualan {sale.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Penjualan dan catatan pembayarannya hilang dari laporan. Stok produk yang tercatat
              dikembalikan. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Simpan penjualan</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(async () => {
                  await onDelete(sale);
                  setConfirmDelete(false);
                }, "Penjualan belum terhapus. Coba lagi.")
              }
            >
              Hapus penjualan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
