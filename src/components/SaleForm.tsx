import { useId, useMemo, useState } from "react";
import { MoneyInput, Section, field, parseRupiah } from "@/components/form-parts";
import { Check, Inbox, Lock, Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PaymentChip } from "@/components/status";
import { formatRupiah } from "@/lib/currency";
import { derive, isAllDigital, newPayment, validatePayments, waNumber } from "@/lib/books";
import { optionPrice, orderCode, type CatalogProduct } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Customer, Inventory, PaymentMethodV2, PaymentState, Sale, SaleInput, SaleItem } from "@/types/books";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const num = parseRupiah;
const blankItem = (): SaleItem => ({ name: "", option: "", kind: "physical", quantity: 1, unitPrice: 0, unitCost: 0 });
const methods: { id: PaymentMethodV2; label: string }[] = [
  { id: "Transfer", label: "Transfer" },
  { id: "QRIS", label: "QRIS" },
  { id: "Cash", label: "Tunai" },
  { id: "EWallet", label: "E-wallet" },
];
export function SaleForm({
  sale,
  prefill,
  products,
  customers,
  inventory,
  submitLabel,
  onSubmit,
  onCancel,
  onDirtyChange,
}: {
  sale?: Sale;
  prefill?: Partial<SaleInput>;
  products: CatalogProduct[];
  customers: Customer[];
  inventory: Record<string, Inventory>;
  submitLabel?: string;
  onSubmit: (input: SaleInput) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const listId = useId();
  const source = sale ?? prefill;
  const [customerId, setCustomerId] = useState<string | undefined>(source?.customerId);
  const [customer, setCustomer] = useState(source?.customer ?? { name: "", whatsapp: "", address: "" });
  const [items, setItems] = useState<SaleItem[]>(source?.items?.length ? source.items : []);
  const [shipping, setShipping] = useState(String(source?.shipping || ""));
  const [discount, setDiscount] = useState(String(source?.discount || ""));
  const [fees, setFees] = useState(String(source?.fees || ""));
  const [date, setDate] = useState(toLocalInput(source?.date ?? new Date().toISOString()));
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [dp, setDp] = useState("");
  const [method, setMethod] = useState<PaymentMethodV2>("Transfer");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const baseInput = (payments: SaleInput["payments"]): SaleInput => ({
    date,
    channel: sale?.channel ?? prefill?.channel ?? "manual",
    orderRequestId: sale?.orderRequestId ?? prefill?.orderRequestId,
    customerId,
    customer,
    items,
    shipping: num(shipping),
    discount: num(discount),
    fees: num(fees),
    payments,
    fulfillment: sale?.fulfillment ?? { status: "confirmed", courier: "", trackingNo: "", deliveryNote: "", updatedAt: date },
    notes,
  });
  const totals = useMemo(() => derive(baseInput(sale?.payments ?? [])), [
    date, customer, items, shipping, discount, fees, notes, sale,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  const payNow = sale ? 0 : num(dp);
  const paid = (sale ? totals.paid : 0) + payNow;
  const balance = Math.max(0, totals.total - paid);
  const state: PaymentState = totals.total > 0 && paid >= totals.total ? "paid" : paid > 0 ? "partial" : "unpaid";
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const dirty = () => onDirtyChange(true);
  const fromRequest = !sale && prefill?.orderRequestId;

  function setItem(index: number, patch: Partial<SaleItem>) {
    setItems((previous) => previous.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    dirty();
  }
  function addProduct(product: CatalogProduct) {
    const option = product.options[0]?.label ?? "";
    setItems((previous) => {
      const existing = previous.findIndex((item) => item.productId === product.id && item.option === option);
      if (existing >= 0) return previous.map((item, i) => (i === existing ? { ...item, quantity: item.quantity + 1 } : item));
      return [
        ...previous,
        {
          productId: product.id,
          name: product.name,
          option,
          kind: product.kind,
          quantity: 1,
          unitPrice: optionPrice(product, option),
          unitCost: inventory[product.id]?.cost ?? 0,
        },
      ];
    });
    setPickerOpen(false);
    setPickerQuery("");
    dirty();
  }
  function changeName(value: string) {
    setCustomer((previous) => ({ ...previous, name: value }));
    const match = customers.find((c) => c.name.trim().toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setCustomerId(match.id);
      setCustomer((previous) => ({
        name: value,
        whatsapp: previous.whatsapp || match.whatsapp,
        address: previous.address || match.address,
      }));
    } else setCustomerId(undefined);
    dirty();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!customer.name.trim()) return setError("Isi nama pelanggan.");
    if (!items.length) return setError("Tambahkan minimal satu produk.");
    if (items.some((i) => !i.name.trim() || i.unitPrice <= 0)) return setError("Setiap produk perlu nama dan harga jual lebih dari nol.");
    if (!sale && payNow > totals.total) return setError("Pembayaran melebihi total. Kurangi jumlah DP.");
    if (sale) {
      const [issue] = validatePayments(sale.payments, { total: totals.total, cancelled: false });
      if (issue)
        return setError(
          issue.code === "overpaid" ? "Total baru lebih kecil dari yang sudah dibayar. Catat pengembalian dana atau sesuaikan total." : issue.message,
        );
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...baseInput([...(sale?.payments ?? []), ...(payNow > 0 ? [newPayment(payNow, method, new Date(date).toISOString())] : [])]),
        date: new Date(date).toISOString(),
        customer: { name: customer.name.trim(), whatsapp: waNumber(customer.whatsapp), address: customer.address.trim() },
      });
    } catch {
      setError("Penjualan belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const term = pickerQuery.trim().toLocaleLowerCase("id-ID");
  const pickable = products.filter((p) => !term || p.name.toLocaleLowerCase("id-ID").includes(term)).slice(0, 30);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex min-w-0 flex-col gap-4">
        {fromRequest && (
          <p className="flex gap-2.5 rounded-xl border-[1.5px] border-dashed border-request/40 bg-request-soft/60 px-4 py-3 text-[13px]">
            <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-request" aria-hidden="true" />
            <span>
              Diisi dari <strong className="font-mono">PERMINTAAN #{orderCode(prefill!.orderRequestId!)}</strong>. Periksa harga dan ongkir — penjualan baru dibuat setelah Anda <strong>menyimpan</strong>.
            </span>
          </p>
        )}

        <Section step={1} title="Pelanggan" hint={customerId ? "Pelanggan lama" : "Cari atau tambah baru"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-name">
              Nama
              <input
                id="sale-name"
                list={listId}
                autoComplete="off"
                placeholder="Pilih atau tambah pelanggan"
                value={customer.name}
                onChange={(e) => changeName(e.target.value)}
                className={cn(field, "font-normal")}
              />
              <datalist id={listId}>
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-wa">
              Nomor WhatsApp
              <input
                id="sale-wa"
                inputMode="tel"
                placeholder="6281234567890"
                value={customer.whatsapp}
                onChange={(e) => {
                  setCustomer({ ...customer, whatsapp: e.target.value });
                  dirty();
                }}
                className={cn(field, "font-normal")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold sm:col-span-2" htmlFor="sale-address">
              Alamat pengiriman
              <input
                id="sale-address"
                placeholder="Jalan, kelurahan, kota"
                value={customer.address}
                onChange={(e) => {
                  setCustomer({ ...customer, address: e.target.value });
                  dirty();
                }}
                className={cn(field, "font-normal")}
              />
            </label>
          </div>
        </Section>

        <Section step={2} title="Produk">
          {items.length > 0 && (
            <div className="mb-3 hidden grid-cols-[minmax(0,1.6fr)_120px_130px_130px_36px] gap-3 border-b pb-2 text-xs font-semibold text-muted-foreground md:grid">
              <span>Produk &amp; pilihan</span>
              <span>Jumlah</span>
              <span>Harga satuan</span>
              <span>Modal satuan</span>
              <span className="sr-only">Hapus</span>
            </div>
          )}
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <li key={index} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1.6fr)_120px_130px_130px_36px] md:items-center md:rounded-none md:border-0 md:p-0">
                  <div className="min-w-0 space-y-1.5">
                    {product ? (
                      <p className="font-semibold">{item.name}</p>
                    ) : (
                      <input
                        aria-label={`Nama produk ${index + 1}`}
                        placeholder="Nama produk"
                        value={item.name}
                        onChange={(e) => setItem(index, { name: e.target.value })}
                        className={cn(field, "h-10")}
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {product && product.options.length > 0 && (
                        <select
                          aria-label={`${product.optionLabel} untuk ${item.name}`}
                          value={item.option}
                          onChange={(e) => setItem(index, { option: e.target.value, unitPrice: optionPrice(product, e.target.value) })}
                          className="h-8 rounded-md border border-input bg-card px-1.5 text-xs text-foreground"
                        >
                          {product.options.map((o) => (
                            <option key={o.label} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setItem(index, { kind: item.kind === "digital" ? "physical" : "digital" })}
                        aria-label={`Jenis ${item.name || `produk ${index + 1}`}: ${item.kind === "digital" ? "digital" : "fisik"}. Ketuk untuk mengganti.`}
                        className="rounded border px-1.5 py-px text-[11px] font-medium hover:bg-accent"
                      >
                        {item.kind === "digital" ? "Digital" : "Fisik"}
                      </button>
                    </div>
                  </div>
                  <div role="group" aria-label={`Jumlah ${item.name || `produk ${index + 1}`}`} className="flex h-10 items-center rounded-[10px] border border-input bg-card md:h-11">
                    <button type="button" aria-label="Kurangi jumlah" disabled={item.quantity <= 1} onClick={() => setItem(index, { quantity: item.quantity - 1 })} className="flex h-full w-9 items-center justify-center disabled:opacity-40">
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <input
                      aria-label="Jumlah"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => setItem(index, { quantity: Math.max(1, num(e.target.value)) })}
                      className="num h-full w-full min-w-0 bg-transparent text-center text-sm font-semibold outline-none"
                    />
                    <button type="button" aria-label="Tambah jumlah" onClick={() => setItem(index, { quantity: item.quantity + 1 })} className="flex h-full w-9 items-center justify-center">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground md:block">
                    <span className="md:sr-only">Harga satuan</span>
                    <MoneyInput id={`item-price-${index}`} label={`Harga satuan ${item.name || `produk ${index + 1}`}`} value={item.unitPrice ? String(item.unitPrice) : ""} onChange={(v) => setItem(index, { unitPrice: num(v) })} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground md:block">
                    <span className="flex items-center gap-1 md:sr-only"><Lock className="h-3 w-3" aria-hidden="true" />Modal satuan (hanya untuk Anda)</span>
                    <MoneyInput
                      id={`item-cost-${index}`}
                      label={`Modal satuan ${item.name || `produk ${index + 1}`}`}
                      value={item.unitCost ? String(item.unitCost) : ""}
                      onChange={(v) => setItem(index, { unitCost: num(v) })}
                      className="border-dashed bg-background"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Hapus ${item.name || `produk ${index + 1}`}`}
                    onClick={() => {
                      setItems(items.filter((_, i) => i !== index));
                      dirty();
                    }}
                    className="flex h-10 w-9 items-center justify-center justify-self-end rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {products.length > 0 && (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-11 rounded-[10px]">
                    <ShoppingBag /> Pilih dari katalog
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-2">
                  <label className="flex h-10 items-center gap-2 rounded-lg border px-2.5">
                    <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">Cari produk katalog</span>
                    <input autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Cari produk" className="h-full flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <ul aria-label="Produk katalog" className="mt-1.5 max-h-72 overflow-y-auto">
                    {pickable.map((product) => (
                      <li key={product.id}>
                        <button type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent">
                          <span className="min-w-0 truncate font-medium">{product.name}</span>
                          <span className="num shrink-0 text-xs text-muted-foreground">{formatRupiah(product.price)}</span>
                        </button>
                      </li>
                    ))}
                    {pickable.length === 0 && <li className="px-2.5 py-3 text-sm text-muted-foreground">Produk tidak ditemukan.</li>}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            <button
              type="button"
              disabled={items.length >= 20}
              onClick={() => {
                setItems([...items, blankItem()]);
                dirty();
              }}
              className="h-11 rounded-[10px] px-2 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {items.length ? "Tambah manual" : "Tambah produk manual"}
            </button>
          </div>
        </Section>

        <Section step={3} title={sale ? "Ongkir, diskon & catatan" : "Ongkir, diskon & pembayaran"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-shipping">
              Ongkir
              <MoneyInput id="sale-shipping" label="Ongkir" value={shipping} onChange={(v) => { setShipping(v); dirty(); }} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-discount">
              Diskon
              <MoneyInput id="sale-discount" label="Diskon" value={discount} onChange={(v) => { setDiscount(v); dirty(); }} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-fees">
              Biaya lain
              <MoneyInput id="sale-fees" label="Biaya admin/kemasan" value={fees} onChange={(v) => { setFees(v); dirty(); }} />
              <span className="text-xs font-normal text-muted-foreground">Admin/kemasan, ditanggung Anda</span>
            </label>
          </div>
          {!sale ? (
            <div className="mt-4 grid gap-4 rounded-xl bg-background p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="sale-dp" className="text-[13px] font-semibold">DP / bayar sekarang</label>
                <MoneyInput id="sale-dp" label="DP / bayar sekarang" value={dp} onChange={(v) => { setDp(v); dirty(); }} />
                <div role="group" aria-label="Isi cepat pembayaran" className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Belum bayar", value: 0 },
                    { label: "50%", value: Math.round(totals.total / 2) },
                    { label: "Lunas", value: totals.total },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      aria-pressed={payNow === q.value && (q.value > 0 || dp === "" || dp === "0")}
                      onClick={() => {
                        setDp(q.value ? String(q.value) : "");
                        dirty();
                      }}
                      className={cn(
                        "h-8 rounded-lg border px-2.5 text-xs font-medium hover:bg-accent",
                        payNow === q.value && "border-primary/50 bg-primary-soft text-primary-ink dark:bg-primary/15 dark:text-primary",
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[13px] font-semibold">Metode</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={method === m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-1 rounded-[10px] border bg-card text-[13px] hover:bg-accent",
                        method === m.id && "border-primary bg-primary-soft font-semibold text-primary-ink dark:bg-primary/15 dark:text-primary",
                      )}
                    >
                      {method === m.id && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-background px-4 py-3 text-[13px] text-muted-foreground">
              Pembayaran dan pengembalian dana dicatat di detail penjualan.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-notes">
              Catatan pesanan
              <textarea
                id="sale-notes"
                rows={2}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  dirty();
                }}
                className="rounded-[10px] border border-input bg-card px-3 py-2 text-sm font-normal outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor="sale-date">
              Tanggal
              <input id="sale-date" type="datetime-local" value={date} onChange={(e) => { setDate(e.target.value); dirty(); }} className={cn(field, "font-normal")} />
            </label>
          </div>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-0 lg:self-start">
        <section aria-label="Ringkasan penjualan" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card sm:p-6">
          <h3 className="text-base font-semibold">Ringkasan</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal · {itemCount} barang</dt><dd className="num">{formatRupiah(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Ongkir</dt><dd className="num">{formatRupiah(totals.shipping)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Diskon</dt><dd className="num text-destructive">− {formatRupiah(totals.discount)}</dd></div>
          </dl>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="num text-[26px] font-bold tracking-tight">{formatRupiah(totals.total)}</span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-clay/25">
            <div className="h-full rounded-full bg-primary" style={{ width: `${totals.total ? Math.min(100, (paid / totals.total) * 100) : 0}%` }} />
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{sale ? "Sudah dibayar" : "Dibayar sekarang"}</dt><dd className="num font-semibold">{formatRupiah(paid)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Sisa tagihan</dt><dd className="num font-semibold text-request">{formatRupiah(balance)}</dd></div>
          </dl>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PaymentChip state={state} />
            dihitung otomatis
          </p>
          <div className="space-y-1.5 rounded-xl bg-background p-3.5 text-[13px]">
            <p className="flex items-center gap-1.5 font-semibold"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Hanya untuk Anda</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Modal barang</span><span className="num">{formatRupiah(totals.cost)}</span></div>
            {totals.fees > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Biaya admin/kemasan</span><span className="num">{formatRupiah(totals.fees)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Perkiraan untung</span><span className="num font-bold text-success">{formatRupiah(totals.profit)}</span></div>
          </div>
          {isAllDigital(items) && <p className="text-xs text-muted-foreground">Semua produk digital: tidak perlu dikemas atau dikirim kurir.</p>}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" className="h-12 rounded-xl text-[15px]" disabled={saving}>
            {saving ? "Menyimpan…" : submitLabel ?? (sale ? "Simpan perubahan" : "Simpan penjualan")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        </section>
      </aside>
    </form>
  );
}
