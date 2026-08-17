/**
 * PRD §7.33/§11: "Centralized, filterable (Monthly/Quarterly/Yearly/
 * Custom), exportable (PDF/Excel/CSV) reports across every module."
 * `resolvePeriodRange` (period.ts) turns one of these into a concrete
 * `[from, to]` range; each report definition (definitions/*.ts) turns a
 * range plus module-specific filters into a `ReportResult`.
 */
export type ReportPeriodInput =
  | { period: "monthly"; year: number; month: number }
  | { period: "quarterly"; year: number; quarter: number }
  | { period: "yearly"; year: number }
  | { period: "custom"; from: string; to: string };

/** A report's own additional, module-specific narrowing (e.g. a department id) — always optional, layered on top of the resolved date range every report shares. */
export interface ReportFilters {
  period: ReportPeriodInput;
  departmentId?: string;
  status?: string;
}

/** A column's machine key (matches a `ReportResult.rows[number]` property) and its human display label — shared verbatim across the on-screen table and every export format, so a column never has to be named twice. */
export interface ReportColumn {
  key: string;
  label: string;
  /** Right-aligns in the on-screen table and export formats that support alignment (PDF/Excel) — set for numeric/currency columns. Defaults to left-aligned text. */
  align?: "left" | "right";
}

/** A cell value is always one of these three JSON-safe primitives — never a Date object, a nested object, or `undefined` (use `null`) — so every export format (CSV, Excel, PDF) can render any report's rows with the same generic formatting logic, with no per-report special-casing. */
export type ReportCellValue = string | number | null;

export interface ReportResult {
  reportKey: string;
  title: string;
  /** The resolved date range this result was generated for — always present, even for a report whose rows aren't literally date-filtered (see each definition's own doc comment for what "period" means for it). */
  period: { from: string; to: string };
  columns: ReportColumn[];
  rows: Record<string, ReportCellValue>[];
}

export type ReportKey =
  | "members"
  | "attendance"
  | "invitations"
  | "contributions"
  | "expenses"
  | "vendors"
  | "assets"
  | "events"
  | "logistics"
  | "technical"
  | "uniforms"
  | "discipline"
  | "hr"
  | "management";
