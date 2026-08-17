"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { gatePasses } from "@ngc/services";
import { gatePassStatusLabel, gatePassStatusTone } from "./status";

export function GatePassTable({ rows }: { rows: gatePasses.GatePass[] }) {
  const columns: TableColumn<gatePasses.GatePass>[] = [
    {
      key: "gatePassNumber",
      header: "Gate pass",
      render: (row) => (
        <Link href={`/gate-passes/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.gatePassNumber}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={gatePassStatusTone(row.status)} label={gatePassStatusLabel(row.status)} />,
    },
    {
      key: "expectedDeparture",
      header: "Expected departure",
      render: (row) => (row.expectedDeparture ? new Date(row.expectedDeparture).toLocaleString() : "—"),
    },
    {
      key: "expectedReturn",
      header: "Expected return",
      render: (row) => (row.expectedReturn ? new Date(row.expectedReturn).toLocaleString() : "—"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No gate passes yet"
      emptyDescription="Create one from the form once equipment needs to leave for an event."
    />
  );
}
