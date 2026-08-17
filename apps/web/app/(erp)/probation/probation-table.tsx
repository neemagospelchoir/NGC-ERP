"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { probation } from "@ngc/services";
import { probationStatusLabel, probationStatusTone } from "./status";

/** See apps/web/app/(erp)/departments/departments-table.tsx's doc comment for why this table's column render closures must live in a Client Component, not the Server Component page that fetches the rows. */
export function ProbationTable({ rows }: { rows: probation.ProbationSummary[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const columns: TableColumn<probation.ProbationSummary>[] = [
    {
      key: "memberName",
      header: "Member",
      render: (row) => (
        <Link href={`/probation/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.memberName}
        </Link>
      ),
    },
    { key: "memberNumber", header: "Member #", render: (row) => row.memberNumber },
    { key: "startedAt", header: "Started", render: (row) => new Date(row.startedAt).toLocaleDateString() },
    {
      key: "deadline",
      header: "Deadline",
      render: (row) => (
        <span className={row.status === "active" && row.deadline < today ? "font-medium text-status-critical" : undefined}>
          {new Date(row.deadline).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={probationStatusTone(row.status)} label={probationStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No probation records found"
      emptyDescription="No probation records match the current filter."
    />
  );
}
