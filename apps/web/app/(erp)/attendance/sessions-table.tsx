"use client";

import Link from "next/link";
import { Table, type TableColumn } from "@ngc/ui";
import type { attendance } from "@ngc/services";
import { sessionTypeLabel } from "./status";

/** See apps/web/app/(erp)/departments/departments-table.tsx's doc comment for why this table's column render closures must live in a Client Component, not the Server Component page that fetches the rows. */
export function SessionsTable({ rows }: { rows: attendance.AttendanceSessionSummary[] }) {
  const columns: TableColumn<attendance.AttendanceSessionSummary>[] = [
    {
      key: "title",
      header: "Session",
      render: (row) => (
        <Link href={`/attendance/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "sessionType", header: "Type", render: (row) => sessionTypeLabel(row.sessionType) },
    { key: "departmentName", header: "Department", render: (row) => row.departmentName ?? "Whole choir" },
    { key: "sessionDate", header: "Date", render: (row) => new Date(row.sessionDate).toLocaleDateString() },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No attendance sessions found"
      emptyDescription="No sessions match the current filter."
    />
  );
}
