import { emptyProduct, productSchema, type CatalogProductFields } from "@/lib/catalog";
import type { Inventory } from "@/types/books";

/** Most products one import can add; keeps the review table usable on a phone. */
export const MAX_IMPORT_ROWS = 50;

export interface ImportRow {
  /** Spreadsheet line (header is line 1), or photo position. */
  line: number;
  fields: CatalogProductFields;
  /** null when the row gives neither cost nor stock. */
  inventory: Inventory | null;
  errors: string[];
}

/**
 * Splits CSV or text pasted from a spreadsheet. Detects tab (copied from
 * Excel/Sheets), semicolon (Excel with Indonesian settings) or comma, and
 * handles quoted cells with commas, quotes and line breaks.
 */
export function parseTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = source.split("\n").find((l) => l.trim()) ?? "";
  const counts = { "\t": 0, ";": 0, ",": 0 } as Record<string, number>;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const delimiter = counts["\t"] ? "\t" : counts[";"] > counts[","] ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

const columns = {
  name: ["nama", "nama produk", "produk", "name", "product"],
  price: ["harga", "harga jual", "price"],
  category: ["kategori", "category"],
  description: ["deskripsi", "keterangan", "description"],
  availability: ["status", "ketersediaan", "availability"],
  leadTime: ["estimasi", "estimasi po", "lama po", "lead time"],
  kind: ["jenis", "tipe", "kind", "type"],
  optionLabel: ["nama pilihan", "label pilihan", "option label"],
  options: ["pilihan", "varian", "options", "variants"],
  cost: ["modal", "harga modal", "cost"],
  stock: ["stok", "stock"],
  published: ["tampil", "tampilkan", "published", "visible"],
} as const;
type Column = keyof typeof columns;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Maps header cells to fields; unknown headers are ignored. */
export function mapHeader(header: string[]) {
  const found: Partial<Record<Column, number>> = {};
  header.forEach((raw, index) => {
    const h = norm(raw.replace(/\(.*?\)/g, ""));
    for (const [key, names] of Object.entries(columns) as [Column, readonly string[]][]) {
      if (found[key] === undefined && names.includes(h)) found[key] = index;
    }
  });
  return found;
}

/** "Rp 150.000", "150000", "150.000,00", "150,000" → 150000. Empty → null; junk → NaN. */
export function parseAmount(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const cleaned = v.replace(/^rp\.?\s*/i, "").replace(/\s/g, "").replace(/[.,]\d{1,2}$/, "");
  if (!/^[\d.,]+$/.test(cleaned)) return NaN;
  return Number(cleaned.replace(/[.,]/g, ""));
}

const yes = (v: string) => ["ya", "y", "yes", "true", "1", "tampil"].includes(v.trim().toLowerCase());
const no = (v: string) => ["tidak", "t", "no", "n", "false", "0", "sembunyi"].includes(v.trim().toLowerCase());

function availability(v: string): CatalogProductFields["availability"] | null {
  const s = norm(v);
  if (!s || ["ready", "ready stock", "ada", "tersedia"].includes(s)) return "ready";
  if (["po", "pre order", "preorder"].includes(s)) return "preorder";
  if (["habis", "belum tersedia", "kosong", "unavailable"].includes(s)) return "unavailable";
  return null;
}

/** "S, M, L" or "Hitam:150000 | Putih:160000" (price optional per option). */
export function parseOptions(value: string): { label: string; price: number }[] | null {
  if (!value.trim()) return [];
  const parts = value.split(/[|,;]/).map((p) => p.trim()).filter(Boolean);
  const out: { label: string; price: number }[] = [];
  for (const part of parts) {
    const [label, price] = part.split(/[:=]/).map((s) => s.trim());
    const amount = price === undefined ? 0 : parseAmount(price);
    if (!label || (amount !== null && Number.isNaN(amount))) return null;
    out.push({ label, price: amount ?? 0 });
  }
  return out;
}

function toRow(cells: string[], map: Partial<Record<Column, number>>, line: number, publish: boolean): ImportRow {
  const get = (key: Column) => (map[key] === undefined ? "" : cells[map[key]!] ?? "");
  const errors: string[] = [];
  const price = parseAmount(get("price"));
  if (price === null) errors.push("Harga kosong.");
  else if (Number.isNaN(price)) errors.push(`Harga "${get("price")}" tidak terbaca.`);
  const avail = availability(get("availability"));
  if (!avail) errors.push(`Status "${get("availability")}" tidak dikenal. Pakai Ready, PO, atau Habis.`);
  const options = parseOptions(get("options"));
  if (!options) errors.push("Pilihan tidak terbaca. Contoh: S, M, L atau Hitam:150000 | Putih:160000.");
  const kindText = norm(get("kind"));
  const kind: CatalogProductFields["kind"] = ["digital", "produk digital"].includes(kindText) ? "digital" : "physical";
  const fields: CatalogProductFields = {
    ...emptyProduct,
    name: get("name").slice(0, 80),
    description: get("description").slice(0, 1500),
    category: get("category").slice(0, 40),
    price: price && !Number.isNaN(price) ? price : 0,
    availability: avail ?? "ready",
    leadTime: avail === "preorder" ? get("leadTime").slice(0, 100) || "7 hari" : "",
    optionLabel: get("optionLabel").slice(0, 30) || emptyProduct.optionLabel,
    options: (options ?? []).slice(0, 8),
    kind,
    published: get("published") ? (no(get("published")) ? false : yes(get("published")) || publish) : publish,
  };
  if (options && options.length > 8) errors.push("Maksimal 8 pilihan; sisanya diabaikan.");
  const cost = parseAmount(get("cost"));
  const stockText = get("stock");
  const stock = stockText ? Number(stockText.replace(/[^\d-]/g, "")) : null;
  if (cost !== null && Number.isNaN(cost)) errors.push(`Modal "${get("cost")}" tidak terbaca.`);
  if (stockText && !Number.isInteger(stock)) errors.push(`Stok "${stockText}" tidak terbaca.`);
  const inventory = cost !== null || stockText ? { cost: cost && !Number.isNaN(cost) ? cost : 0, stock: stockText && Number.isInteger(stock) ? stock : null } : null;
  return { line, fields, inventory, errors: [...errors, ...validate(fields, errors.length > 0)] };
}

/** Same checks as the product form, phrased for a table row. */
export function validate(fields: CatalogProductFields, skipPrice = false): string[] {
  const result = productSchema.safeParse(fields);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => !(skipPrice && issue.path[0] === "price"))
    .map((issue) => (issue.path[0] === "name" ? "Nama produk kosong." : issue.message));
}

/** Parses an imported table. Fails with a message when the header has no name or price column. */
export function rowsFromTable(text: string, publish = true): { rows: ImportRow[]; error?: string; skipped: number } {
  const table = parseTable(text);
  if (table.length < 2) return { rows: [], skipped: 0, error: "Tidak ada baris produk. Baris pertama harus judul kolom, produk mulai baris kedua." };
  const map = mapHeader(table[0]);
  if (map.name === undefined || map.price === undefined)
    return { rows: [], skipped: 0, error: 'Kolom "Nama" dan "Harga" tidak ditemukan di baris pertama. Pakai template agar kolomnya sesuai.' };
  const body = table.slice(1);
  return {
    rows: body.slice(0, MAX_IMPORT_ROWS).map((cells, i) => toRow(cells, map, i + 2, publish)),
    skipped: Math.max(0, body.length - MAX_IMPORT_ROWS),
  };
}

/** "gamis-katun_rayon (2).JPG" → "Gamis Katun Rayon". */
export function nameFromFile(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\(\d+\)$/, "")
    .replace(/^(img|dsc|pxl|photo|image|whatsapp image)[\s_-]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .slice(0, 80);
}

/** A blank row for a photo; the owner fills in name and price in the review table. */
export function rowFromPhoto(fileName: string, line: number, publish = true): ImportRow {
  const name = /^\d[\d\s_-]*$/.test(nameFromFile(fileName)) ? "" : nameFromFile(fileName);
  const fields = { ...emptyProduct, name, published: publish };
  return { line, fields, inventory: null, errors: validate(fields) };
}

export const TEMPLATE_HEADER = ["Nama", "Harga", "Kategori", "Status", "Estimasi PO", "Jenis", "Pilihan", "Modal", "Stok", "Deskripsi"];
/** Semicolons open correctly in Excel with Indonesian settings and in Google Sheets. */
export function templateCsv() {
  const rows = [
    TEMPLATE_HEADER,
    ["Gamis Katun Rayon", "189000", "Pakaian", "Ready", "", "Fisik", "S, M, L, XL", "104000", "12", "Bahan katun rayon adem"],
    ["Hijab Voal Paris", "45000", "Hijab", "PO", "7 hari", "Fisik", "Hitam:45000 | Mocca:47000", "22000", "", ""],
    ["E-book Resep MPASI", "35000", "Digital", "Ready", "", "Digital", "", "", "", "Dikirim lewat WhatsApp"],
  ];
  return "\uFEFF" + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n") + "\r\n";
}
