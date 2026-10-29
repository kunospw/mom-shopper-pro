type Word = { text: string; l: number; t: number; r: number; b: number; cy: number };
type Group = { ids: number[]; l: number; r: number; t: number; lines: { cy: number; text: string }[] };

const priceOnly = /^(?:(?:rp|idr)[\s.,_:]*)?\d{1,3}(?:[.,]\d{3})+$|^(?:rp|idr)[\s.,_:]*\d+$/i;
const pricedLine = /\d{1,3}[.,]\d{3}|\b(?:rp|idr)\b/i;
// Stylised poster fonts make Tesseract read BULAN as BUIAN/8UIAN; no other words are rewritten.
const duration = /^[B8]U[IL1|l]AN$/i;

/**
 * Rebuilds reading order from Tesseract TSV word boxes. Price-list posters place cards side by side,
 * so plain OCR text interleaves cards on one line. Words that touch become a card; a price-only
 * column joins the row-aligned labels on its left; cards are listed per page column, top to bottom.
 * Only OCR words are emitted: nothing is added except "[Kolom N]" markers and " | " cell gaps.
 */
export function layoutText(tsv: string) {
  const words: Word[] = [];
  for (const line of tsv.split("\n").slice(1)) {
    const f = line.split("\t");
    if (f[0] !== "5" || f.length < 12) continue;
    const conf = Number(f[10]);
    let text = f[11].trim().replace(/^[([{|"'“”‘’\\/]+|[)\]}|"'“”‘’\\/]+$/g, "");
    // Card borders and icons produce short low-confidence fragments.
    if (!/[\p{L}\p{N}]/u.test(text) || conf < 40 || (conf < 70 && text.length <= 3)) continue;
    if (duration.test(text)) text = "BULAN";
    const [l, t, w, h] = f.slice(6, 10).map(Number);
    if (![l, t, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    words.push({ text, l, t, r: l + w, b: t + h, cy: t + h / 2 });
  }
  if (!words.length) return "";
  const heights = words.map(w => w.b - w.t).sort((a, b) => a - b);
  const unit = heights[heights.length >> 1];
  const parent = words.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number) => { parent[find(i)] = find(j); };
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j < words.length; j++) {
      const a = words[i], b = words[j];
      if (Math.max(0, b.l - a.r, a.l - b.r) < unit * 2.2 && Math.max(0, b.t - a.b, a.t - b.b) < unit * 2.2) join(i, j);
    }
  const rows = (ws: Word[]) => {
    const out: { cy: number; words: Word[] }[] = [];
    for (const w of [...ws].sort((a, b) => a.cy - b.cy)) {
      const row = out.find(r => Math.abs(r.cy - w.cy) < unit * 0.6);
      if (row) row.words.push(w); else out.push({ cy: w.cy, words: [w] });
    }
    return out.map(r => {
      r.words.sort((a, b) => a.l - b.l);
      const cells: string[][] = [];
      r.words.forEach((w, k) => (k && w.l - r.words[k - 1].r <= unit * 2 ? cells[cells.length - 1].push(w.text) : cells.push([w.text])));
      let parts = cells.map(c => c.join(" "));
      // Lone characters beside a label ("a | PRIVATE | 2") are card-border/icon fragments. Price rows and
      // rows of short options ("S | M | L") are kept.
      if (!parts.some(x => pricedLine.test(x)) && (parts.length === 1 || parts.some(x => /\p{L}{3}/u.test(x))))
        parts = parts.filter(x => x.length > 1);
      return { cy: r.cy, text: parts.join(" | ") };
    }).filter(r => r.text);
  };
  const groups = (): Group[] => {
    const map = new Map<number, number[]>();
    words.forEach((_, i) => map.set(find(i), [...(map.get(find(i)) ?? []), i]));
    return [...map.values()].map(ids => {
      const ws = ids.map(i => words[i]);
      return { ids, l: Math.min(...ws.map(w => w.l)), r: Math.max(...ws.map(w => w.r)), t: Math.min(...ws.map(w => w.t)), lines: rows(ws) };
    }).filter(g => g.lines.length);
  };
  const initial = groups();
  for (const p of initial.filter(g => g.lines.every(x => priceOnly.test(x.text.replace(/\s*\|\s*/g, " "))))) {
    const left = initial
      .filter(g => g !== p && g.r <= p.l + unit && p.lines.filter(x => g.lines.some(y => Math.abs(y.cy - x.cy) < unit * 0.6)).length * 2 >= p.lines.length)
      .sort((a, b) => b.r - a.r)[0];
    if (left) join(p.ids[0], left.ids[0]);
  }
  const sections = groups();
  const overlap = (a: { l: number; r: number }, b: { l: number; r: number }) =>
    Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * 2 >= Math.min(a.r - a.l, b.r - b.l);
  const priced = (g: Group) => g.lines.some(x => pricedLine.test(x.text));
  const columns: { l: number; r: number; items: Group[] }[] = [];
  for (const s of sections.filter(priced).sort((a, b) => a.l - b.l)) {
    const column = columns.find(c => overlap(c, s));
    if (column) { column.items.push(s); column.l = Math.min(column.l, s.l); column.r = Math.max(column.r, s.r); }
    else columns.push({ l: s.l, r: s.r, items: [s] });
  }
  // Headings belong to the single column they sit in; titles spanning columns stay page-level.
  const page: Group[] = [];
  for (const s of sections.filter(s => !priced(s))) {
    const hits = columns.filter(c => overlap(c, s));
    if (hits.length === 1) hits[0].items.push(s); else page.push(s);
  }
  const render = (list: Group[]) => [...list].sort((a, b) => a.t - b.t).map(s => s.lines.map(x => x.text).join("\n")).join("\n\n");
  return [
    ...(page.length ? [`[Teks lain]\n${render(page)}`] : []),
    ...columns.sort((a, b) => a.l - b.l).map((c, i) => `[Kolom ${i + 1}]\n${render(c.items)}`),
  ].join("\n\n");
}
