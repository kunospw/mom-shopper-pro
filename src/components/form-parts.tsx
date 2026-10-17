import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard text field look for the workspace forms (sale, product, purchase). */
export const field =
  "h-11 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15";

/** Accepts "150.000", "150000" or "Rp 150.000". */
export const parseRupiah = (value: string) => Math.max(0, Math.round(Number(value.replace(/[^\d]/g, ""))) || 0);

/** Input with an "Rp" prefix, as in the design. Value is digits only. */
export function MoneyInput({
  id,
  value,
  onChange,
  label,
  className,
  placeholder = "0",
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
  describedBy?: string;
}) {
  return (
    <span className={cn("flex h-11 items-center overflow-hidden rounded-[10px] border border-input bg-card focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15", className)}>
      <span aria-hidden="true" className="flex h-full items-center border-r bg-background px-2.5 text-sm text-muted-foreground">Rp</span>
      <input
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        inputMode="numeric"
        value={value ? Number(value).toLocaleString("id-ID") : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className="num h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
      />
    </span>
  );
}

/** Numbered form card used by the slide-over forms. */
export function Section({ step, title, hint, children, className }: { step?: number; title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl bg-card p-5 shadow-card sm:p-6", className)}>
      <div className="mb-4 flex items-center gap-2.5">
        {step !== undefined && (
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink dark:bg-primary/15 dark:text-primary">
            {step}
          </span>
        )}
        <h3 id={id} className="flex-1 text-base font-semibold">{title}</h3>
        {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Segmented single choice (radio semantics), e.g. Ready / Preorder / Belum tersedia. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-xl bg-muted p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-10 flex-1 rounded-[9px] px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            value === option.value ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Filter chips with counts (Penjualan, Katalog, Pembelian). */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide md:flex-wrap md:overflow-visible">
      {options.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            "h-9 shrink-0 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            value === f.id ? "bg-foreground font-semibold text-background" : "border border-input font-medium hover:bg-accent",
          )}
        >
          {f.label}
          {f.count !== undefined && <span className="num ml-1.5 opacity-70">{f.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Search box with icon, as on Penjualan. */
export function SearchBox({ id, label, value, onChange, placeholder, className }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label htmlFor={id} className={cn("flex h-10 w-full items-center gap-2 rounded-[10px] border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring sm:w-64", className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="sr-only">{label}</span>
      <input id={id} type="search" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Small summary card (label + big number). */
export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5 shadow-card">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn("num mt-0.5 text-lg font-bold sm:text-xl", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
