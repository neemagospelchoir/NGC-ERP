"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { leave } from "@ngc/services";
import { leaveStatusLabel, leaveStatusTone, leaveTypeLabel } from "./status";

/** See apps/web/app/(erp)/departments/departments-table.tsx's doc comment for why this table's column render closures must live in a Client Component, not the Server Component page that fetches the rows. */
export function LeaveTable({ rows }: { rows: leave.LeaveRequestSummary[] }) {
  const columns: TableColumn<leave.LeaveRequestSummary>[] = [
    {
      key: "memberName",
      header: "Member",
      render: (row) => (
        <Link href={`/leave/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.memberName}
        </Link>
      ),
    },
    { key: "leaveType", header: "Type", render: (row) => leaveTypeLabel(row.leaveType) },
    {
      key: "dates",
      header: "Dates",
      render: (row) => `${new Date(row.startDate).toLocaleDateString()} – ${new Date(row.endDate).toLocaleDateString()}`,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={leaveStatusTone(row.status)} label={leaveStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No leave requests found"
      emptyDescription="No leave requests match the current filter."
    />
  );
}
