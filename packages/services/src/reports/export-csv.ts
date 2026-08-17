import type { ReportResult } from "./types";

/**
 * The one export format simple enough to hand-roll rather than pull in a
 * dependency for (ARCHITECTURE.md §16: "minimal dependency footprint, no
 * unnecessary dependencies" — spec §64). Excel (`exceljs`) and PDF
 * (`@react-pdf/renderer`) genuinely need a real library and live in
 * `apps/web` instead — see docs/PHASE_13_1.md §2 for why CSV alone stays
 * in this framework-agnostic package while those two don't.
 *
 * RFC 4180-style quoting: a field is quoted only when it contains a
 * comma, a double quote, or a newline, with any embedded double quote
 * doubled — the minimum needed for Excel/Sheets/Numbers to round-trip a
 * cell exactly, without quoting every field unconditionally (a common but
 * needlessly noisy alternative).
 *
 * CSV/formula-injection hardening: several of these string columns
 * (invitation organizer/event name, a member's own first/preferred name,
 * ...) ultimately come from free text a caller other than the report
 * viewer supplied — invitations.submitInvitation is a public, unauthenticated
 * form, and members can edit their own name fields. A string cell whose
 * first character is one of `=+-@` (or a tab/CR) is a classic
 * spreadsheet-formula-injection vector: Excel/Sheets/Numbers may evaluate
 * it as a formula the moment a staff member opens the exported file,
 * rather than displaying it as plain text. Prefixing a single leading `'`
 * forces every spreadsheet application to treat the cell as inert text
 * (the standard OWASP CSV Injection mitigation) without changing what a
 * human reader sees. Only `typeof value === "string"` cells are touched —
 * a genuine negative `number` (e.g. a signed total) is never CSV-injection
 * risk and must round-trip as an actual number, not gain a stray quote.
 */
export function toCsv(result: ReportResult): string {
  const header = result.columns.map((c) => c.label);
  const lines = [header, ...result.rows.map((row) => result.columns.map((c) => row[c.key]))];
  return lines.map((line) => line.map(formatCell).join(",")).join("\r\n") + "\r\n";
}

const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? neutralizeFormulaInjection(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function neutralizeFormulaInjection(text: string): string {
  return text.length > 0 && FORMULA_TRIGGER_CHARS.has(text[0]) ? `'${text}` : text;
}
