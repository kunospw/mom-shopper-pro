/**
 * Local-time period helpers. Every report boundary is the device's calendar
 * (month/day), never a slice of a UTC ISO string: in Indonesia (UTC+7) an
 * instant at 00:00-06:59 local on the 1st is still the previous month in UTC.
 */
export interface DateRange {
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
  /** True for the open-ended "all time" range. */
  all?: true;
}
export type Preset =
  | "7-days"
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "this-year"
  | "all-time";

export const ALL_TIME: DateRange = {
  start: new Date(1970, 0, 1),
  end: new Date(2200, 0, 1),
  all: true,
};

export function periodRange(preset: Preset, now: Date = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "7-days":
      return { start: new Date(y, m, now.getDate() - 6), end: new Date(y, m, now.getDate() + 1) };
    case "last-month":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case "last-3-months":
      return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 1) };
    case "last-6-months":
      return { start: new Date(y, m - 5, 1), end: new Date(y, m + 1, 1) };
    case "this-year":
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    case "all-time":
      return ALL_TIME;
    default:
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  }
}

/** Parse "YYYY-MM-DD" as a local calendar date (no time zone shift). */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

/** Inclusive calendar days: from 00:00 of `from` through the end of `to`. */
export function customRange(from: string, to: string): DateRange | null {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b || b < a) return null;
  return { start: a, end: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1) };
}

const isMidnightFirst = (d: Date) =>
  d.getDate() === 1 && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * The period immediately before `range`: whole calendar months shift by the
 * same number of months (so March compares with February, not "28 days
 * earlier"); anything else shifts by its own length. Null for all time.
 */
export function previousRange(range: DateRange): DateRange | null {
  if (range.all) return null;
  if (isMidnightFirst(range.start) && isMidnightFirst(range.end)) {
    const months = monthIndex(range.end) - monthIndex(range.start);
    return {
      start: new Date(range.start.getFullYear(), range.start.getMonth() - months, 1),
      end: range.start,
    };
  }
  const days = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
  return {
    start: new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() - days),
    end: range.start,
  };
}

export function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= range.start.getTime() && t < range.end.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthKey = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/** Today's local date as YYYY-MM-DD for <input type="date"> (not the UTC date). */
export function localToday(now: Date = new Date()): string {
  return dayKey(now);
}

/**
 * Store a date-only input at local noon. `new Date("2026-10-01")` is UTC
 * midnight, which is the previous evening in negative-offset time zones.
 */
export function localDateToISO(value: string): string {
  const date = parseLocalDate(value);
  if (!date) throw new RangeError("Tanggal tidak valid.");
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
}
