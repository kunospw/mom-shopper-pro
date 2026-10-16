import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { derive, isAllDigital, newPayment, waNumber } from "@/lib/books";
import type { CatalogProduct } from "@/lib/catalog";
import type {
  Customer,
  Inventory,
  PaymentMethodV2,
  Sale,
  SaleInput,
  SaleItem,
} from "@/types/books";

const NEW_CUSTOMER = "__new";
const FREE_TEXT = "__free";
const blankItem = (): SaleItem => ({
  name: "",
  option: "",
  kind: "physical",
  quantity: 1,
  unitPrice: 0,
  unitCost: 0,
});
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const num = (value: string) => Math.max(0, Math.round(Number(value)) || 0);

export function SaleForm({
  sale,
  prefill,
  products,
  customers,
  inventory,
  onSubmit,
  onCancel,
  onDirtyChange,
}: {
  sale?: Sale;
  prefill?: Partial<SaleInput>;
  products: CatalogProduct[];
  customers: Customer[];
  inventory: Record<string, Inventory>;
  onSubmit: (input: SaleInput) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const source = sale ?? prefill;
  const [customerId, setCustomerId] = useState(
    source?.customerId ?? NEW_CUSTOMER,
  );
  const [customer, setCustomer] = useState(
    source?.customer ?? { name: "", whatsapp: "", address: "" },
  );
  const [items, setItems] = useState<SaleItem[]>(
    source?.items?.length ? source.items : [blankItem()],
  );
  const [shipping, setShipping] = useState(String(source?.shipping || ""));
  const [discount, setDiscount] = useState(String(source?.discount || ""));
  const [fees, setFees] = useState(String(source?.fees || ""));
  const [date, setDate] = useState(
    toLocalInput(source?.date ?? new Date().toISOString()),
  );
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [dp, setDp] = useState("");
  const [method, setMethod] = useState<PaymentMethodV2>("Transfer");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () =>
      derive({
        date,
        channel: "manual",
        customer,
        items,
        shipping: num(shipping),
        discount: num(discount),
        fees: num(fees),
        payments: [
          ...(sale?.payments ?? []),
          ...(dp ? [newPayment(num(dp), method, date)] : []),
        ],
        fulfillment: sale?.fulfillment ?? {
          status: "confirmed",
          courier: "",
          trackingNo: "",
          deliveryNote: "",
          updatedAt: date,
        },
        notes,
      }),
    [date, customer, items, shipping, discount, fees, dp, method, notes, sale],
  );
  const dirty = () => onDirtyChange(true);

  function setItem(index: number, patch: Partial<SaleItem>) {
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    dirty();
  }
  function pickProduct(index: number, value: string) {
    if (value === FREE_TEXT) return setItem(index, { productId: undefined });
    const product = products.find((p) => p.id === value);
    if (!product) return;
    setItem(index, {
      productId: product.id,
      name: product.name,
      option: product.options[0] ?? "",
      kind: (product as { kind?: SaleItem["kind"] }).kind ?? "physical",
      unitPrice: product.price,
      unitCost: inventory[product.id]?.cost ?? 0,
    });
  }
  function pickCustomer(value: string) {
    setCustomerId(value);
    dirty();
    const found = customers.find((c) => c.id === value);
    if (found)
      setCustomer({
        name: found.name,
        whatsapp: found.whatsapp,
        address: found.address,
      });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!customer.name.trim()) return setError("Isi nama pelanggan.");
    if (items.some((i) => !i.name.trim() || i.unitPrice <= 0))
      return setError(
        "Setiap produk perlu nama dan harga jual lebih dari nol.",
      );
    if (preview.discount < num(discount))
      return setError("Diskon tidak boleh melebihi total pesanan.");
    if (!sale && preview.paid > preview.total)
      return setError("Pembayaran melebihi total. Kurangi jumlah DP.");
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...preview,
        customerId: customerId === NEW_CUSTOMER ? undefined : customerId,
        customer: {
          name: customer.name.trim(),
          whatsapp: waNumber(customer.whatsapp),
          address: customer.address.trim(),
        },
        date: new Date(date).toISOString(),
      });
    } catch {
      setError("Penjualan belum tersimpan. Periksa koneksi, lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Pelanggan</legend>
        {customers.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="sale-customer">Pilih pelanggan</Label>
            <Select value={customerId} onValueChange={pickCustomer}>
              <SelectTrigger id="sale-customer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CUSTOMER}>Pelanggan baru</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sale-name">Nama pelanggan</Label>
            <Input
              id="sale-name"
              autoComplete="off"
              value={customer.name}
              onChange={(e) => {
                setCustomer({ ...customer, name: e.target.value });
                dirty();
              }}
              required
            />
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
        <div className="space-y-2">
          <Label htmlFor="sale-address">Alamat kirim (opsional)</Label>
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
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Produk</legend>
        {items.map((item, index) => (
          <div key={index} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-end gap-2">
              {products.length > 0 && (
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`item-product-${index}`}>
                    Dari katalog (opsional)
                  </Label>
                  <Select
                    value={item.productId ?? FREE_TEXT}
                    onValueChange={(value) => pickProduct(index, value)}
                  >
                    <SelectTrigger id={`item-product-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FREE_TEXT}>Ketik manual</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {items.length > 1 && (
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
                  <Trash2 />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`item-name-${index}`}>Nama produk</Label>
                <Input
                  id={`item-name-${index}`}
                  value={item.name}
                  onChange={(e) => setItem(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-option-${index}`}>Pilihan (opsional)</Label>
                <Input
                  id={`item-option-${index}`}
                  placeholder="Warna, ukuran, paket"
                  value={item.option}
                  onChange={(e) => setItem(index, { option: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-kind-${index}`}>Jenis</Label>
                <Select
                  value={item.kind}
                  onValueChange={(v) =>
                    setItem(index, { kind: v as SaleItem["kind"] })
                  }
                >
                  <SelectTrigger id={`item-kind-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Barang fisik</SelectItem>
                    <SelectItem value="digital">Produk digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-qty-${index}`}>Jumlah</Label>
                <Input
                  id={`item-qty-${index}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    setItem(index, { quantity: Math.max(1, num(e.target.value)) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-price-${index}`}>Harga jual satuan (Rp)</Label>
                <Input
                  id={`item-price-${index}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={item.unitPrice || ""}
                  onChange={(e) =>
                    setItem(index, { unitPrice: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-cost-${index}`}>Modal satuan (Rp)</Label>
                <Input
                  id={`item-cost-${index}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={item.unitCost || ""}
                  onChange={(e) =>
                    setItem(index, { unitCost: num(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= 20}
          onClick={() => {
            setItems([...items, blankItem()]);
            dirty();
          }}
        >
          <Plus /> Tambah produk
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Biaya dan pembayaran</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["sale-shipping", "Ongkos kirim (Rp)", shipping, setShipping],
            ["sale-discount", "Diskon (Rp)", discount, setDiscount],
            ["sale-fees", "Biaya admin/kemasan (Rp)", fees, setFees],
          ].map(([id, label, value, set]) => (
            <div key={id as string} className="space-y-2">
              <Label htmlFor={id as string}>{label as string}</Label>
              <Input
                id={id as string}
                type="number"
                inputMode="numeric"
                min={0}
                value={value as string}
                onChange={(e) => {
                  (set as (v: string) => void)(e.target.value);
                  dirty();
                }}
              />
            </div>
          ))}
        </div>
        {!sale && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sale-dp">Dibayar sekarang / DP (Rp)</Label>
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
            <div className="space-y-2">
              <Label htmlFor="sale-method">Metode</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethodV2)}
              >
                <SelectTrigger id="sale-method">
                  <SelectValue />
                </SelectTrigger>
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
      </fieldset>

      <section
        aria-label="Ringkasan penjualan"
        className="space-y-1 rounded-lg bg-muted/50 p-4 text-sm"
      >
        <p className="flex justify-between">
          <span>Total</span>
          <strong>{formatRupiah(preview.total)}</strong>
        </p>
        <p className="flex justify-between text-muted-foreground">
          <span>Sudah dibayar</span>
          <span>{formatRupiah(preview.paid)}</span>
        </p>
        <p className="flex justify-between">
          <span>Sisa tagihan</span>
          <strong>{formatRupiah(preview.balance)}</strong>
        </p>
        <p className="flex justify-between text-muted-foreground">
          <span>Perkiraan untung</span>
          <span>{formatRupiah(preview.profit)}</span>
        </p>
        {isAllDigital(items) && (
          <p className="pt-1 text-xs text-muted-foreground">
            Semua produk digital: tidak perlu dikemas atau dikirim kurir.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="min-w-0 flex-1" disabled={saving}>
          {saving ? "Menyimpan…" : sale ? "Simpan perubahan" : "Simpan penjualan"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
      </div>
    </form>
  );
}
