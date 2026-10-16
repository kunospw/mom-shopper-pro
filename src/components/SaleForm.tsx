import { useId, useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatRupiah } from "@/lib/currency";
import { derive, isAllDigital, newPayment, validatePayments, waNumber } from "@/lib/books";
import { optionPrice, type CatalogProduct } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type {
  Customer,
  Inventory,
  PaymentMethodV2,
  Sale,
  SaleInput,
  SaleItem,
} from "@/types/books";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const num = (value: string) => Math.max(0, Math.round(Number(value)) || 0);
const blankItem = (): SaleItem => ({
  name: "",
  option: "",
  kind: "physical",
  quantity: 1,
  unitPrice: 0,
  unitCost: 0,
});
type PayMode = "none" | "dp" | "full";
const payModes: { id: PayMode; label: string }[] = [
  { id: "none", label: "Belum bayar" },
  { id: "dp", label: "DP" },
  { id: "full", label: "Lunas" },
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
  const [customerId, setCustomerId] = useState<string | undefined>(
    source?.customerId,
  );
  const [customer, setCustomer] = useState(
    source?.customer ?? { name: "", whatsapp: "", address: "" },
  );
  const [items, setItems] = useState<SaleItem[]>(
    source?.items?.length ? source.items : [],
  );
  const [shipping, setShipping] = useState(String(source?.shipping || ""));
  const [discount, setDiscount] = useState(String(source?.discount || ""));
  const [fees, setFees] = useState(String(source?.fees || ""));
  const [date, setDate] = useState(
    toLocalInput(source?.date ?? new Date().toISOString()),
  );
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [payMode, setPayMode] = useState<PayMode>("none");
  const [dp, setDp] = useState("");
  const [method, setMethod] = useState<PaymentMethodV2>("Transfer");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [extras, setExtras] = useState(
    !!(source?.shipping || source?.discount || source?.fees || source?.notes),
  );
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
    fulfillment: sale?.fulfillment ?? {
      status: "confirmed",
      courier: "",
      trackingNo: "",
      deliveryNote: "",
      updatedAt: date,
    },
    notes,
  });
  const totals = useMemo(() => derive(baseInput(sale?.payments ?? [])), [
    date, customer, items, shipping, discount, fees, notes, sale,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  const payAmount = sale
    ? 0
    : payMode === "full"
      ? totals.total
      : payMode === "dp"
        ? num(dp)
        : 0;
  const paid = (sale ? totals.paid : 0) + payAmount;
  const dirty = () => onDirtyChange(true);

  function setItem(index: number, patch: Partial<SaleItem>) {
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    dirty();
  }
  function addProduct(product: CatalogProduct) {
    const option = product.options[0]?.label ?? "";
    setItems((previous) => {
      const existing = previous.findIndex(
        (item) => item.productId === product.id && item.option === option,
      );
      if (existing >= 0)
        return previous.map((item, i) =>
          i === existing ? { ...item, quantity: item.quantity + 1 } : item,
        );
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
    dirty();
  }
  function changeName(value: string) {
    setCustomer((previous) => ({ ...previous, name: value }));
    const match = customers.find(
      (c) => c.name.trim().toLowerCase() === value.trim().toLowerCase(),
    );
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
    if (items.some((i) => !i.name.trim() || i.unitPrice <= 0))
      return setError("Setiap produk perlu nama dan harga jual lebih dari nol.");
    if (!sale && payMode === "dp" && payAmount <= 0)
      return setError("Isi jumlah DP, atau pilih Belum bayar.");
    if (!sale && payAmount > totals.total)
      return setError("Pembayaran melebihi total. Kurangi jumlah DP.");
    if (sale) {
      const [issue] = validatePayments(sale.payments, { total: totals.total, cancelled: false });
      if (issue)
        return setError(
          issue.code === "overpaid"
            ? "Total baru lebih kecil dari yang sudah dibayar. Catat pengembalian dana atau sesuaikan total."
            : issue.message,
        );
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...baseInput([
          ...(sale?.payments ?? []),
          ...(payAmount > 0 ? [newPayment(payAmount, method, new Date(date).toISOString())] : []),
        ]),
        date: new Date(date).toISOString(),
        customer: {
          name: customer.name.trim(),
          whatsapp: waNumber(customer.whatsapp),
          address: customer.address.trim(),
        },
      });
    } catch {
      setError("Penjualan belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const balance = Math.max(0, totals.total - paid);
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="space-y-3" aria-labelledby="sf-customer">
        <h3 id="sf-customer" className="text-sm font-semibold">Pelanggan</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sale-name">Nama</Label>
            <Input
              id="sale-name"
              list={listId}
              autoComplete="off"
              placeholder="Ketik nama atau pilih pelanggan lama"
              value={customer.name}
              onChange={(e) => changeName(e.target.value)}
            />
            <datalist id={listId}>
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-wa">WhatsApp (opsional)</Label>
            <Input
              id="sale-wa"
              inputMode="tel"
              placeholder="6281234567890"
              value={customer.whatsapp}
              onChange={(e) => {
                setCustomer({ ...customer, whatsapp: e.target.value });
                dirty();
              }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="sf-items">
        <h3 id="sf-items" className="text-sm font-semibold">Produk</h3>
        {products.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Ketuk untuk menambah dari katalog</p>
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {products.slice(0, 24).map((product) => (
                <li key={product.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex min-h-11 items-center gap-2 rounded-full border bg-card px-3 text-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {product.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {items.map((item, index) => {
          const product = products.find((p) => p.id === item.productId);
          const expanded = open.has(index);
          return (
            <div key={index} className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor={`item-name-${index}`} className="sr-only">Nama produk {index + 1}</Label>
                  <Input
                    id={`item-name-${index}`}
                    placeholder="Nama produk"
                    value={item.name}
                    onChange={(e) => setItem(index, { name: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus produk ${index + 1}`}
                  onClick={() => {
                    setItems(items.filter((_, i) => i !== index));
                    dirty();
                  }}
                >
                  <X />
                </Button>
              </div>
              {product && product.options.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor={`item-option-${index}`} className="text-xs">{product.optionLabel}</Label>
                  <Select
                    value={item.option}
                    onValueChange={(option) =>
                      setItem(index, { option, unitPrice: optionPrice(product, option) })
                    }
                  >
                    <SelectTrigger id={`item-option-${index}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {product.options.map((o) => (
                        <SelectItem key={o.label} value={o.label}>
                          {o.label}{o.price > 0 ? ` · ${formatRupiah(o.price)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div role="group" aria-label={`Jumlah produk ${index + 1}`} className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Kurangi jumlah"
                    disabled={item.quantity <= 1}
                    onClick={() => setItem(index, { quantity: item.quantity - 1 })}
                  >
                    <Minus />
                  </Button>
                  <Input
                    aria-label="Jumlah"
                    className="w-14 text-center"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem(index, { quantity: Math.max(1, num(e.target.value)) })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Tambah jumlah"
                    onClick={() => setItem(index, { quantity: item.quantity + 1 })}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="min-w-32 flex-1 space-y-1">
                  <Label htmlFor={`item-price-${index}`} className="text-xs">Harga satuan (Rp)</Label>
                  <Input
                    id={`item-price-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="num"
                    value={item.unitPrice || ""}
                    onChange={(e) => setItem(index, { unitPrice: num(e.target.value) })}
                  />
                </div>
                <p className="num pb-3 text-sm font-semibold">{formatRupiah(item.unitPrice * item.quantity)}</p>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setOpen((previous) => {
                    const next = new Set(previous);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                Modal dan jenis produk
              </button>
              {expanded && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`item-cost-${index}`} className="text-xs">Modal satuan (Rp)</Label>
                    <Input
                      id={`item-cost-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={item.unitCost || ""}
                      onChange={(e) => setItem(index, { unitCost: num(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`item-kind-${index}`} className="text-xs">Jenis</Label>
                    <Select value={item.kind} onValueChange={(v) => setItem(index, { kind: v as SaleItem["kind"] })}>
                      <SelectTrigger id={`item-kind-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Barang fisik</SelectItem>
                        <SelectItem value="digital">Produk digital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= 20}
          onClick={() => {
            setItems([...items, blankItem()]);
            dirty();
          }}
        >
          <Plus /> {items.length ? "Tambah produk lain" : "Tambah produk manual"}
        </Button>
      </section>

      {!sale && (
        <section className="space-y-3" aria-labelledby="sf-pay">
          <h3 id="sf-pay" className="text-sm font-semibold">Pembayaran</h3>
          <div role="group" aria-labelledby="sf-pay" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {payModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={payMode === mode.id}
                onClick={() => {
                  setPayMode(mode.id);
                  dirty();
                }}
                className={cn(
                  "min-h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  payMode === mode.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {payMode !== "none" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {payMode === "dp" && (
                <div className="space-y-2">
                  <Label htmlFor="sale-dp">Jumlah DP (Rp)</Label>
                  <Input
                    id="sale-dp"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={dp}
                    onChange={(e) => {
                      setDp(e.target.value);
                      dirty();
                    }}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="sale-method">Dibayar lewat</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethodV2)}>
                  <SelectTrigger id="sale-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                    <SelectItem value="QRIS">QRIS</SelectItem>
                    <SelectItem value="EWallet">E-wallet</SelectItem>
                    <SelectItem value="Cash">Tunai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="sf-extra" className="space-y-3">
        <button
          type="button"
          id="sf-extra"
          aria-expanded={extras}
          onClick={() => setExtras(!extras)}
          className="flex items-center gap-1 text-sm font-semibold"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", extras && "rotate-180")} aria-hidden="true" />
          Ongkir, diskon, dan catatan
        </button>
        {extras && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["sale-shipping", "Ongkos kirim (Rp)", shipping, setShipping],
                ["sale-discount", "Diskon (Rp)", discount, setDiscount],
                ["sale-fees", "Biaya admin/kemasan (Rp)", fees, setFees],
              ] as const).map(([id, label, value, set]) => (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={value}
                    onChange={(e) => {
                      set(e.target.value);
                      dirty();
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-address">Alamat kirim</Label>
              <Textarea
                id="sale-address"
                rows={2}
                value={customer.address}
                onChange={(e) => {
                  setCustomer({ ...customer, address: e.target.value });
                  dirty();
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sale-date">Tanggal</Label>
                <Input
                  id="sale-date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    dirty();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-notes">Catatan</Label>
                <Input
                  id="sale-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    dirty();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 space-y-3 border-t bg-background/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:p-6">
        <section aria-label="Ringkasan penjualan" className="space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <strong className="num text-base">{formatRupiah(totals.total)}</strong>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">Sisa tagihan</span>
            <span className="num font-medium">{formatRupiah(balance)}</span>
          </p>
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>Perkiraan untung</span>
            <span className="num">{formatRupiah(totals.profit)}</span>
          </p>
          {isAllDigital(items) && (
            <p className="text-xs text-muted-foreground">
              Semua produk digital: tidak perlu dikemas atau dikirim kurir.
            </p>
          )}
        </section>
        <div className="flex gap-2">
          <Button type="submit" className="min-w-0 flex-1" disabled={saving}>
            {saving ? "Menyimpan…" : submitLabel ?? (sale ? "Simpan perubahan" : "Simpan penjualan")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        </div>
      </div>
    </form>
  );
}
