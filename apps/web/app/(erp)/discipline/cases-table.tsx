"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { discipline } from "@ngc/services";
import { caseStatusLabel, caseStatusTone } from "./status";

/** See apps/web/app/(erp)/departments/departments-table.tsx's doc comment for why this table's column render closures must live in a Client Component, not the Server Component page that fetches the rows. */
export function CasesTable({ rows }: { rows: discipline.CaseSummary[] }) {
  const columns: TableColumn<discipline.CaseSummary>[] = [
    {
      key: "caseNumber",
      header: "Case #",
      render: (row) => (
        <Link href={`/discipline/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.caseNumber}
        </Link>
      ),
    },
    { key: "memberName", header: "Member", render: (row) => row.memberName },
    { key: "category", header: "Category", render: (row) => row.category },
    { key: "incidentDate", header: "Incident date", render: (row) => new Date(row.incidentDate).toLocaleDateString() },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={caseStatusTone(row.status)} label={caseStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No disciplinary cases found"
      emptyDescription="No cases match the current filter."
    />
  );
}
