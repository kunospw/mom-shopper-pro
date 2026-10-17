import { useState } from "react";
import {
  ArrowRight,
  Ban,
  Banknote,
  Check,
  Ellipsis,
  FileText,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FulfillmentChip, PaidBar, PaymentChip } from "@/components/status";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRupiah } from "@/lib/currency";
import { isAllDigital, isRefund, newPayment, newRefund, nextFulfillment, validatePayments, whatsAppUpdateLink } from "@/lib/books";
import { orderCode } from "@/lib/catalog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { FulfillmentStatus, Payment, PaymentMethodV2, Sale } from "@/types/books";

const methodLabel: Record<PaymentMethodV2, string> = { Transfer: "Transfer", QRIS: "QRIS", Cash: "Tunai", EWallet: "E-wallet" };
const methods = Object.keys(methodLabel) as PaymentMethodV2[];
const COURIERS = ["JNE", "J&T Express", "SiCepat", "AnterAja", "Pos Indonesia", "GoSend", "GrabExpress", "Kurir toko"];
const num = (value: string) => Math.max(0, Math.round(Number(value.replace(/[^\d]/g, ""))) || 0);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const nextLabel: Partial<Record<FulfillmentStatus, string>> = {
  packed: "Tandai sudah dikemas",
  shipped: "Tandai sudah dikirim",
  delivered: "Tandai sudah terkirim",
  done: "Tandai selesai",
};

function paymentTitle(p: Payment, index: number, all: Payment[], total: number) {
  if (isRefund(p)) return p.reason === "cancellation" ? "Pengembalian (batal)" : "Pengembalian dana";
  const before = all.slice(0, index).filter((x) => !isRefund(x)).reduce((s, x) => s + x.amount, 0);
  if (before === 0 && p.amount < total) return "DP";
  if (before + p.amount >= total) return before === 0 ? "Lunas" : "Pelunasan";
  return "Cicilan";
}

function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <span className="flex h-11 items-center overflow-hidden rounded-[10px] border border-input bg-card focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
        <span aria-hidden="true" className="flex h-full items-center border-r bg-background px-2.5 text-sm font-normal text-muted-foreground">Rp</span>
        <input id={id} aria-label={label} inputMode="numeric" value={value ? Number(value).toLocaleString("id-ID") : ""} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} className="num h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none" />
      </span>
    </label>
  );
}

function MethodPicker({ value, onChange }: { value: PaymentMethodV2; onChange: (m: PaymentMethodV2) => void }) {
  return (
    <div role="group" aria-label="Metode" className="grid grid-cols-4 gap-1.5">
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "h-9 rounded-lg border bg-card text-xs hover:bg-accent",
            value === m && "border-primary bg-primary-soft font-semibold text-primary-ink dark:bg-primary/15 dark:text-primary",
          )}
        >
          {methodLabel[m]}
        </button>
      ))}
    </div>
  );
}

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
  const [form, setForm] = useState<"payment" | "refund" | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodV2>("Transfer");
  const [courier, setCourier] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
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
  const steps: FulfillmentStatus[] = digital ? ["confirmed", "delivered", "done"] : ["confirmed", "packed", "shipped", "done"];
  const stepNames: Record<string, string> = digital
    ? { confirmed: "Dikonfirmasi", delivered: "Terkirim", done: "Selesai" }
    : { confirmed: "Dikonfirmasi", packed: "Dikemas", shipped: "Dikirim", done: "Selesai" };
  const current = Math.max(0, steps.indexOf(!digital && sale.fulfillment.status === "delivered" ? "shipped" : sale.fulfillment.status));
  const courierValue = courier ?? sale.fulfillment.courier;
  const trackingValue = tracking ?? sale.fulfillment.trackingNo;
  const noteValue = note ?? sale.fulfillment.deliveryNote;
  const reminder =
    sale.customer.whatsapp && sale.balance > 0
      ? `https://wa.me/${sale.customer.whatsapp}?text=${encodeURIComponent(
          `Halo ${sale.customer.name}, ini tagihan ${sale.number}${user?.businessName ? ` dari ${user.businessName}` : ""}. Total ${formatRupiah(sale.total)}, sudah dibayar ${formatRupiah(sale.paid)}. Sisa ${formatRupiah(sale.balance)}. Terima kasih.`,
        )}`
      : "";

  const withSale = (patch: Partial<Sale>) => ({ ...sale, ...patch }) as Sale;
  const savePayment = () => {
    const value = num(amount);
    if (value <= 0) return setError(form === "refund" ? "Isi jumlah pengembalian." : "Isi jumlah pembayaran.");
    const entry =
      form === "refund"
        ? newRefund(value, method, new Date().toISOString(), "", cancelled ? "cancellation" : "return")
        : newPayment(value, method, new Date().toISOString());
    const payments = [...sale.payments, entry];
    const [issue] = validatePayments(payments, { total: sale.total, cancelled });
    if (issue)
      return setError(
        issue.code === "overpaid"
          ? `Jumlah melebihi sisa tagihan ${formatRupiah(sale.balance)}.`
          : form === "refund"
            ? `Pengembalian tidak boleh melebihi yang sudah dibayar (${formatRupiah(sale.paid)}).`
            : issue.message,
      );
    void run(async () => {
      await onChange(withSale({ payments }));
      setAmount("");
      setForm(null);
    }, form === "refund" ? "Pengembalian belum tersimpan. Coba lagi." : "Pembayaran belum tersimpan. Coba lagi.");
  };
  const saveFulfillment = (status: FulfillmentStatus) =>
    run(
      () =>
        onChange(
          withSale({
            fulfillment: {
              ...sale.fulfillment,
              status,
              courier: courierValue.trim(),
              trackingNo: trackingValue.trim(),
              deliveryNote: noteValue,
              updatedAt: new Date().toISOString(),
            },
          }),
        ),
      "Status belum berubah. Coba lagi.",
    );

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" closeLabel="Tutup detail" className="flex w-full flex-col gap-0 p-0 sm:max-w-[536px]">
          <div className="flex-1 overflow-y-auto">
            <SheetHeader className="space-y-3 border-b px-6 pb-5 pt-5 pr-16 text-left">
              <SheetDescription className="text-[13px]">
                <span className="font-mono font-medium text-foreground">{sale.number}</span> · {new Date(sale.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                {sale.orderRequestId && <> · dari permintaan <span className="font-mono">#{orderCode(sale.orderRequestId)}</span></>}
              </SheetDescription>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SheetTitle className="text-xl">
                    <span className="sr-only">{sale.number} · </span>
                    {sale.customer.name || "Pelanggan"}
                  </SheetTitle>
                  <p className="text-[13px] text-muted-foreground">{[sale.customer.whatsapp, sale.customer.address].filter(Boolean).join(" · ") || "Tanpa kontak"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="num text-[22px] font-bold tracking-tight">{formatRupiah(sale.total)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PaymentChip state={cancelled && sale.refundDue > 0 ? "refund-due" : sale.paymentState} />
                <FulfillmentChip status={sale.fulfillment.status} />
              </div>
            </SheetHeader>

            <div className="space-y-6 px-6 py-5">
              <section aria-labelledby="sd-items" className="space-y-2 text-sm">
                <h3 id="sd-items" className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Produk</h3>
                <ul className="space-y-1.5">
                  {sale.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {item.quantity}× {item.name}
                        {item.option && <span className="text-muted-foreground"> · {item.option}</span>}
                        {item.kind === "digital" && <span className="text-muted-foreground"> · digital</span>}
                      </span>
                      <span className="num font-medium">{formatRupiah(item.unitPrice * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1 border-t border-dashed pt-2 text-[13px] text-muted-foreground">
                  <p className="flex justify-between"><span>Ongkir</span><span className="num">{formatRupiah(sale.shipping)}</span></p>
                  <p className="flex justify-between"><span>Diskon</span><span className="num">{sale.discount ? `− ${formatRupiah(sale.discount)}` : formatRupiah(0)}</span></p>
                  <p className="flex justify-between"><span className="flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden="true" />Perkiraan untung</span><span className="num">{formatRupiah(sale.profit)}</span></p>
                </div>
              </section>

              <section aria-labelledby="sd-pay" className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <h3 id="sd-pay" className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pembayaran</h3>
                  {!cancelled && sale.balance > 0 && form !== "payment" && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm("payment");
                        setAmount("");
                        setError("");
                      }}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-[13px] font-semibold text-primary-ink hover:opacity-90 dark:bg-primary/15 dark:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tambah pembayaran
                    </button>
                  )}
                </div>
                <PaidBar paid={Math.max(0, sale.paid)} total={sale.total} />
                <p className="flex justify-between text-[13px]">
                  <span>Dibayar <strong className="num">{formatRupiah(sale.paid)}</strong></span>
                  {cancelled ? (
                    sale.refundDue > 0 && <span>Perlu dikembalikan <strong className="num text-request">{formatRupiah(sale.refundDue)}</strong></span>
                  ) : (
                    <span>Sisa <strong className="num text-request">{formatRupiah(sale.balance)}</strong></span>
                  )}
                </p>
                {sale.payments.length === 0 ? (
                  <p className="rounded-xl bg-background px-4 py-3 text-[13px] text-muted-foreground">Belum ada pembayaran dicatat.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sale.payments.map((p, i, all) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-2.5 text-[13px]">
                        <span className="flex items-center gap-2">
                          {isRefund(p) ? <Undo2 className="h-4 w-4 text-request" aria-hidden="true" /> : <Banknote className="h-4 w-4 text-success" aria-hidden="true" />}
                          {paymentTitle(p, i, all, sale.total)} · {methodLabel[p.method] ?? p.method} · {shortDate(p.date)}
                        </span>
                        <span className={cn("num font-semibold", isRefund(p) && "text-request")}>
                          {isRefund(p) ? "− " : ""}
                          {formatRupiah(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {form && (
                  <div className="space-y-3 rounded-xl border p-4">
                    <MoneyField
                      id="sd-amount"
                      label={form === "refund" ? "Jumlah dikembalikan" : "Jumlah pembayaran"}
                      value={amount}
                      onChange={setAmount}
                    />
                    {form === "payment" && sale.balance > 0 && (
                      <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setAmount(String(sale.balance))}>
                        Isi sisa tagihan ({formatRupiah(sale.balance)})
                      </button>
                    )}
                    {form === "refund" && (
                      <p className="text-xs text-muted-foreground">
                        {cancelled
                          ? "Uang dikembalikan karena penjualan dibatalkan. Hanya mengurangi kas."
                          : "Retur atau potongan harga: mengurangi penjualan di bulan pengembalian, sisa tagihan tidak berubah."}
                      </p>
                    )}
                    <MethodPicker value={method} onChange={setMethod} />
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1" disabled={busy} onClick={savePayment}>
                        <Check /> Simpan
                      </Button>
                      <Button type="button" variant="ghost" disabled={busy} onClick={() => setForm(null)}>Batal</Button>
                    </div>
                  </div>
                )}
                {!form && reminder && (
                  <Button asChild variant="outline" className="h-11 w-full rounded-xl border-success/35 text-success hover:bg-success-soft hover:text-success">
                    <a href={reminder} target="_blank" rel="noopener noreferrer"><MessageCircle /> Kirim tagihan via WhatsApp</a>
                  </Button>
                )}
                {!form && sale.paid > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm("refund");
                      setAmount(cancelled ? String(sale.refundDue) : "");
                      setError("");
                    }}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Catat pengembalian dana
                  </button>
                )}
              </section>

              {!cancelled && (
                <section aria-labelledby="sd-ful" className="space-y-4 text-sm">
                  <h3 id="sd-ful" className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Pengiriman · {digital ? "Produk digital" : "Barang fisik"}
                  </h3>
                  <ol aria-label="Langkah pengiriman" className="flex items-start">
                    {steps.map((step, i) => {
                      const done = i < current || (i === current && step === "done");
                      const now = i === current && !done;
                      return (
                        <li key={step} aria-current={now ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                          {i > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 top-[11px] h-0.5 w-full", i <= current ? "bg-primary" : "bg-border")} />}
                          <span
                            className={cn(
                              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full",
                              done ? "bg-primary text-primary-foreground" : now ? "border-[3px] border-primary bg-card" : "border-2 border-border bg-card",
                            )}
                          >
                            {done && <Check className="h-3 w-3" aria-hidden="true" />}
                          </span>
                          <span className={cn("text-xs", now || done ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {stepNames[step]}
                            <span className="sr-only">{done ? " (selesai)" : now ? " (sekarang)" : ""}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {!digital ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
                      <label htmlFor="sd-courier" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                        Kurir
                        <input
                          id="sd-courier"
                          list="sd-couriers"
                          value={courierValue}
                          onChange={(e) => setCourier(e.target.value)}
                          placeholder="Pilih atau ketik kurir"
                          className="h-11 rounded-[10px] border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
                        />
                        <datalist id="sd-couriers">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
                      </label>
                      <label htmlFor="sd-resi" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                        Nomor resi
                        <input
                          id="sd-resi"
                          value={trackingValue}
                          onChange={(e) => setTracking(e.target.value)}
                          placeholder="Isi setelah paket dikirim"
                          className="h-11 rounded-[10px] border border-input bg-card px-3 font-mono text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
                        />
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="sd-note" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        Catatan pengiriman digital
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" />pribadi</span>
                      </span>
                      <textarea
                        id="sd-note"
                        rows={3}
                        value={noteValue}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Kode, akun, atau tautan untuk pembeli"
                        aria-describedby="sd-note-hint"
                        className="rounded-[10px] border border-input bg-card px-3 py-2 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
                      />
                      <span id="sd-note-hint" className="text-xs font-normal text-muted-foreground">Tidak pernah tampil di halaman status pembeli. Kirim ke pembeli lewat WhatsApp.</span>
                    </label>
                  )}
                  {next ? (
                    <Button type="button" className="h-12 w-full rounded-xl text-[15px]" disabled={busy} onClick={() => void saveFulfillment(next)}>
                      <ArrowRight /> {nextLabel[next] ?? "Lanjutkan"}
                    </Button>
                  ) : (
                    (courier !== null || tracking !== null || note !== null) && (
                      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void saveFulfillment(sale.fulfillment.status)}>
                        Simpan perubahan pengiriman
                      </Button>
                    )
                  )}
                </section>
              )}

              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            </div>
          </div>

          <div className="flex gap-2.5 border-t bg-card px-6 py-4">
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => onInvoice(sale)}>
              <FileText /> Invoice
            </Button>
            {link ? (
              <Button asChild variant="outline" className="h-12 flex-1 rounded-xl text-success hover:text-success">
                <a href={link} target="_blank" rel="noopener noreferrer"><MessageCircle /> Kabari pelanggan</a>
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl" disabled title="Tambahkan nomor WhatsApp pelanggan untuk mengirim kabar">
                <MessageCircle /> Kabari pelanggan
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl" aria-label="Tindakan lain">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {!cancelled && (
                  <DropdownMenuItem onSelect={() => onEdit(sale)}>
                    <Pencil /> Ubah penjualan
                  </DropdownMenuItem>
                )}
                {cancelled ? (
                  <DropdownMenuItem disabled={busy} onSelect={() => void saveFulfillment("confirmed")}>
                    <RotateCcw /> Buka kembali
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={busy} onSelect={() => void saveFulfillment("cancelled")}>
                    <Ban /> Batalkan penjualan
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus penjualan {sale.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Penjualan dan catatan pembayarannya hilang dari laporan. Stok produk yang tercatat dikembalikan. Tindakan ini tidak bisa dibatalkan.
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
