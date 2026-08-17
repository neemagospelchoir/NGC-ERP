import ExcelJS from "exceljs";
import type { reports } from "@ngc/services";

/**
 * Excel export renderer. Web-only (see docs/PHASE_13_1.md §2 for why this
 * lives in apps/web rather than packages/services): takes the exact same
 * `ReportResult` the on-screen table and the CSV exporter (`export-csv.ts`
 * in packages/services) render, so there is exactly one place — each
 * report definition in packages/services/src/reports/definitions/*.ts —
 * that decides what data appears in a report, no matter which format the
 * user downloads.
 */
export async function renderXlsx(result: reports.ReportResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NGC ERP";
  workbook.created = new Date(0); // deterministic; the file's own metadata timestamp isn't meaningful to a report reader.

  const sheet = workbook.addWorksheet(result.title.slice(0, 31) || "Report");

  sheet.columns = result.columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.max(col.label.length + 2, 14),
    style: col.align === "right" ? { alignment: { horizontal: "right" } } : undefined,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of result.rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
