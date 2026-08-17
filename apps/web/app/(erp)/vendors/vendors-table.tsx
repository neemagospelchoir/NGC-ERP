"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { vendors } from "@ngc/services";

const STATUS_TONE: Record<vendors.VendorStatus, "good" | "neutral" | "critical"> = {
  active: "good",
  inactive: "neutral",
  blacklisted: "critical",
};

export function VendorsTable({ rows, categoryNameById }: { rows: vendors.Vendor[]; categoryNameById: Map<string, string> }) {
  const columns: TableColumn<vendors.Vendor>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/vendors/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "category", header: "Category", render: (row) => categoryNameById.get(row.categoryId) ?? "—" },
    { key: "contact", header: "Contact", render: (row) => row.contactPerson ?? "—" },
    { key: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={STATUS_TONE[row.status]} label={row.status.charAt(0).toUpperCase() + row.status.slice(1)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No vendors yet"
      emptyDescription="Add the first vendor using the form."
    />
  );
}
