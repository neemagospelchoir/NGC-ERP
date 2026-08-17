"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { applications } from "@ngc/services";
import { applicationStatusLabel, applicationStatusTone } from "./status";

/** See apps/web/app/(erp)/departments/departments-table.tsx's doc comment for why this table's column render closures must live in a Client Component, not the Server Component page that fetches the rows. */
export function ApplicationsTable({ rows }: { rows: applications.ApplicationSummary[] }) {
  const columns: TableColumn<applications.ApplicationSummary>[] = [
    {
      key: "applicationNumber",
      header: "Application",
      render: (row) => (
        <Link href={`/applications/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.applicationNumber}
        </Link>
      ),
    },
    { key: "applicantName", header: "Applicant", render: (row) => row.applicantName },
    { key: "completion", header: "Complete", render: (row) => `${row.completionPercentage}%` },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={applicationStatusTone(row.status)} label={applicationStatusLabel(row.status)} />,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      render: (row) => (row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No applications found"
      emptyDescription="No applications match the current filter."
    />
  );
}
