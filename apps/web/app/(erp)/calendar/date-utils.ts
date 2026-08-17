/**
 * Small, dependency-free month-window math for the Calendar's agenda view.
 * Deliberately not a calendar-grid library — `@ngc/ui` has no grid widget
 * (see docs/PHASE_10_3.md §1 for the scoping decision), and an agenda list
 * grouped by date only needs "first/last day of month" + "add N months",
 * both of which are a handful of lines of plain `Date` arithmetic.
 */

/** Parses `YYYY-MM` (or defaults to the current month) into a UTC-safe `{ year, month }` (month is 1-indexed). */
export function parseMonthParam(monthParam: string | undefined, todayIso: string): { year: number; month: number } {
  const source = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayIso.slice(0, 7);
  const [year, month] = source.split("-").map(Number);
  return { year, month };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroIndexed = month - 1 + delta;
  const newYear = year + Math.floor(zeroIndexed / 12);
  const newMonth = ((zeroIndexed % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function monthParam(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
