"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { families } from "@ngc/services";

/** See departments/departments-table.tsx's doc comment for why this table's column definitions (and their render closures) must live in a Client Component, not the Server Component page that fetches the rows. */
export function FamiliesTable({ rows }: { rows: families.Family[] }) {
  const columns: TableColumn<families.Family>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/families/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "description", header: "Description", render: (row) => row.description ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isActive ? <StatusPill tone="good" label="Active" /> : <StatusPill tone="neutral" label="Inactive" />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No families yet"
      emptyDescription="Add the choir's first family using the form."
    />
  );
}
