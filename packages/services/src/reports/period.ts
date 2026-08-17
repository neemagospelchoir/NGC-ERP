import { ServiceError } from "../shared/errors";
import type { ReportPeriodInput } from "./types";

/**
 * Resolves an explicit Monthly/Quarterly/Yearly/Custom filter (PRD §11/
 * §7.33: "Centralized, filterable (Monthly/Quarterly/Yearly/Custom)... "
 * reports") into a concrete `[from, to]` ISO date range (inclusive on both
 * ends). Deliberately takes an explicit `year`/`month`/`quarter` rather
 * than defaulting to "the current one" the way the mobile Calendar screen
 * does (`apps/mobile/app/(app)/events.tsx`'s `monthRange(new Date())`) —
 * a report is something a Finance Manager runs for "March 2026" or "Q3
 * 2025" days or months after the fact, not only for "right now," so the
 * period must be a caller-supplied parameter, not derived from the current
 * date. This also keeps the function pure and trivially testable with no
 * `Date.now()` dependency.
 */
export function resolvePeriodRange(input: ReportPeriodInput): { from: string; to: string } {
  switch (input.period) {
    case "monthly": {
      validateMonth(input.month);
      const from = isoDate(input.year, input.month, 1);
      const to = isoDate(input.year, input.month, daysInMonth(input.year, input.month));
      return { from, to };
    }
    case "quarterly": {
      if (!Number.isInteger(input.quarter) || input.quarter < 1 || input.quarter > 4) {
        throw new ServiceError("Quarter must be an integer between 1 and 4.");
      }
      const startMonth = (input.quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const from = isoDate(input.year, startMonth, 1);
      const to = isoDate(input.year, endMonth, daysInMonth(input.year, endMonth));
      return { from, to };
    }
    case "yearly": {
      const from = isoDate(input.year, 1, 1);
      const to = isoDate(input.year, 12, 31);
      return { from, to };
    }
    case "custom": {
      if (!input.from || !input.to) {
        throw new ServiceError("A custom period requires both a from and a to date.");
      }
      if (input.to < input.from) {
        throw new ServiceError("A custom period's end date cannot be before its start date.");
      }
      return { from: input.from, to: input.to };
    }
    default: {
      // Exhaustiveness guard — a new ReportPeriodInput variant added to
      // types.ts without a matching case here fails loudly at compile time
      // (via the `never` assignment) rather than silently falling through.
      const _exhaustive: never = input;
      throw new ServiceError(`Unrecognized report period: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function validateMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ServiceError("Month must be an integer between 1 and 12.");
  }
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the *next* month is the last day of `month` — a standard,
  // DST-safe trick since this only ever reads the date component, and the
  // date component of a UTC midnight Date is never shifted by DST.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
