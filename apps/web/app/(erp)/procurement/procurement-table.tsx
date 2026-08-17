"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { procurement } from "@ngc/services";
import { procurementStatusLabel, procurementStatusTone } from "./status";

export function ProcurementTable({
  rows,
  expenseRequestNumberById,
  vendorNameById,
}: {
  rows: procurement.ProcurementRequest[];
  expenseRequestNumberById: Map<string, string>;
  vendorNameById: Map<string, string>;
}) {
  const columns: TableColumn<procurement.ProcurementRequest>[] = [
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <Link href={`/procurement/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.description}
        </Link>
      ),
    },
    {
      key: "expenseRequest",
      header: "Expense request",
      render: (row) => expenseRequestNumberById.get(row.expenseRequestId) ?? "—",
    },
    { key: "vendor", header: "Vendor", render: (row) => (row.vendorId ? vendorNameById.get(row.vendorId) ?? "—" : "—") },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={procurementStatusTone(row.status)} label={procurementStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No procurement requests yet"
      emptyDescription="Start one from an approved expense request using the form."
    />
  );
}
