"use client";

import { Table, type TableColumn } from "@ngc/ui";
import type { reports } from "@ngc/services";

/**
 * A thin client-component wrapper around `@ngc/ui`'s `Table`, matching the
 * pattern every other module's `*-table.tsx` already uses (see e.g.
 * invitations/invitations-table.tsx) — `Table` is itself a "use client"
 * component, and a Server Component (page.tsx) cannot pass it a `render`
 * function prop directly (functions aren't serializable across the
 * server/client boundary; only a Server Component→Client Component
 * "props" hop is, and `TableColumn.render` is a plain closure, not a
 * Server Action). Building the `columns` array here, entirely on the
 * client side, is what makes that legal — page.tsx only ever hands this
 * component the serializable `ReportResult.columns`/`rows` data.
 */
export function ReportResultTable({ result }: { result: reports.ReportResult }) {
  const columns: TableColumn<Record<string, reports.ReportCellValue>>[] = result.columns.map((col) => ({
    key: col.key,
    header: col.label,
    numeric: col.align === "right",
    render: (row) => {
      const value = row[col.key];
      return value === null || value === undefined || value === "" ? "—" : String(value);
    },
  }));

  return (
    <Table
      columns={columns}
      rows={result.rows}
      rowKey={(row) => JSON.stringify(row)}
      emptyTitle="No data for this period"
      emptyDescription="Try widening the period or clearing a filter."
    />
  );
}
