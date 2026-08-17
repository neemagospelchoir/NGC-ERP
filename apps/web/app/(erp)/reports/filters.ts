import { reports } from "@ngc/services";

export type ReportSearchParams = {
  report?: string;
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
  from?: string;
  to?: string;
  department?: string;
  status?: string;
  format?: string;
};

const REPORT_KEYS = reports.listReportDefinitions().map((d) => d.key);

// Strict YYYY-MM-DD only. A custom period's from/to end up verbatim in
// `ReportResult.period` (via resolvePeriodRange's custom branch, which
// only string-compares them) and from there directly into the export
// route's downloaded filename — so unlike a monthly/quarterly/yearly
// period (always Postgres-date-typed columns that would reject a
// malformed value on their own), nothing downstream naturally rejects a
// malformed `from`/`to` for the Invitations report, whose period
// filtering is an in-memory string comparison rather than a Postgres date
// column. Validating the shape here, once, closes that gap for every
// caller of parseReportSearchParams (both the page and the export route).
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turns the reports page's (and the export route's — both need the exact
 * same parsing so a "download" link always reproduces what's on screen)
 * raw `searchParams` into a validated `ReportKey` + `ReportFilters`, or an
 * `error` for the caller to render/reject. Never throws — a malformed or
 * missing query param is a normal "no report selected yet" state on the
 * page, not a crash.
 */
export function parseReportSearchParams(
  searchParams: ReportSearchParams
): { reportKey: reports.ReportKey; filters: reports.ReportFilters } | { error: string } {
  const reportKey = searchParams.report;
  if (!reportKey || !REPORT_KEYS.includes(reportKey as reports.ReportKey)) {
    return { error: "Select a report to run." };
  }

  const periodType = searchParams.period ?? "monthly";
  let period: reports.ReportPeriodInput;
  try {
    period = buildPeriodInput(periodType, searchParams);
  } catch {
    return { error: "Enter a valid period for this report." };
  }

  return {
    reportKey: reportKey as reports.ReportKey,
    filters: {
      period,
      departmentId: searchParams.department || undefined,
      status: searchParams.status || undefined,
    },
  };
}

function buildPeriodInput(periodType: string, searchParams: ReportSearchParams): reports.ReportPeriodInput {
  // Falls back to the real current year (not a fixed constant — this is
  // ordinary Next.js request-time code, not a Workflow script) only when
  // the form hasn't supplied one yet, matching every other filter's
  // "unset means show me something reasonable right now" default.
  const year = searchParams.year ? Number.parseInt(searchParams.year, 10) : new Date().getFullYear();
  if (!Number.isInteger(year)) throw new Error("invalid year");

  switch (periodType) {
    case "monthly": {
      const month = searchParams.month ? Number.parseInt(searchParams.month, 10) : 1;
      return { period: "monthly", year, month };
    }
    case "quarterly": {
      const quarter = searchParams.quarter ? Number.parseInt(searchParams.quarter, 10) : 1;
      return { period: "quarterly", year, quarter };
    }
    case "yearly":
      return { period: "yearly", year };
    case "custom": {
      if (!searchParams.from || !searchParams.to) throw new Error("custom period requires from/to");
      if (!ISO_DATE_PATTERN.test(searchParams.from) || !ISO_DATE_PATTERN.test(searchParams.to)) {
        throw new Error("custom period from/to must be YYYY-MM-DD");
      }
      return { period: "custom", from: searchParams.from, to: searchParams.to };
    }
    default:
      throw new Error(`unrecognized period type: ${periodType}`);
  }
}

/** The query string a "download" link/form should submit with, built from the exact same fields the on-screen filter form uses — kept here (not duplicated in page.tsx and the export route) so the two can never drift. */
export function reportQueryString(searchParams: ReportSearchParams, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
}
