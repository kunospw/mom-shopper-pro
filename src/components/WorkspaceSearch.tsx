import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ReceiptText, Search, UserRound, type LucideIcon } from "lucide-react";
import { useBooks } from "@/contexts/BooksContext";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Result = { id: string; icon: LucideIcon; group: string; title: string; detail: string; to: string };

const norm = (value: string) => value.toLocaleLowerCase("id-ID");

/**
 * Top-bar search over what is already loaded: customers, invoices (by number or
 * customer) and products (from sale lines). "/" focuses it from anywhere.
 */
export function WorkspaceSearch() {
  const { sales, customers } = useBooks();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = norm(query.trim());
    if (term.length < 2) return [];
    const out: Result[] = [];
    const seenCustomers = new Set<string>();
    for (const c of customers) {
      if (out.length >= 4) break;
      if (norm(`${c.name} ${c.whatsapp}`).includes(term)) {
        seenCustomers.add(norm(c.name));
        out.push({ id: `c-${c.id}`, icon: UserRound, group: "Pelanggan", title: c.name, detail: c.whatsapp || "Pelanggan", to: `/sales?q=${encodeURIComponent(c.name)}` });
      }
    }
    const invoices = sales
      .filter((s) => norm(`${s.number} ${s.customer.name}`).includes(term))
      .slice(0, 5)
      .map((s) => ({
        id: `s-${s.id}`,
        icon: ReceiptText,
        group: "Penjualan",
        title: `${s.number} · ${s.customer.name || "Pelanggan"}`,
        detail: formatRupiah(s.total),
        to: `/sales?view=${s.id}`,
      }));
    const products = new Map<string, Result>();
    for (const s of sales)
      for (const item of s.items)
        if (products.size < 4 && norm(item.name).includes(term) && !products.has(norm(item.name)))
          products.set(norm(item.name), {
            id: `p-${norm(item.name)}`,
            icon: Package,
            group: "Produk",
            title: item.name,
            detail: "Lihat penjualan produk ini",
            to: `/sales?q=${encodeURIComponent(item.name)}`,
          });
    return [...out, ...invoices, ...products.values()];
  }, [query, sales, customers]);

  function choose(result: Result) {
    setOpen(false);
    setQuery("");
    navigate(result.to);
  }

  const showList = open && query.trim().length >= 2;
  return (
    <div className="relative w-full max-w-[420px]">
      <label className="flex h-11 items-center gap-2.5 rounded-xl border border-transparent bg-card px-3.5 shadow-card focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Cari pelanggan, invoice, atau produk</span>
        <input
          ref={input}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          value={query}
          placeholder="Cari pelanggan, invoice, atau produk"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd aria-hidden="true" className="rounded-md border px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
      </label>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Hasil pencarian"
          className="absolute left-0 right-0 top-12 z-40 max-h-96 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-pop"
        >
          {results.length === 0 ? (
            <li role="option" aria-selected="false" aria-disabled="true" className="px-3 py-3 text-sm text-muted-foreground">
              Tidak ada yang cocok dengan “{query.trim()}”.
            </li>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(r)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2", i === active && "bg-accent")}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.group} · {r.detail}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
