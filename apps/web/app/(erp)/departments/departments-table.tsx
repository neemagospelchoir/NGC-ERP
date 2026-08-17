"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { departments } from "@ngc/services";

/**
 * A Server Component may not pass function props (like TableColumn.render)
 * into a Client Component — React throws "Functions cannot be passed
 * directly to Client Components" at render time, since a function isn't
 * serializable across the RSC boundary. This is exactly that boundary: the
 * page.tsx Server Component fetches and passes only plain, serializable
 * `rows` data; the column definitions (which close over JSX/render
 * functions) live here, inside the client tree, where creating a function
 * value is unremarkable. Discovered while adding Playwright coverage for
 * Phase 7.1 — see docs/PHASE_7_1.md's "Errors and fixes" section.
 */
export function DepartmentsTable({ rows }: { rows: departments.Department[] }) {
  const columns: TableColumn<departments.Department>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/departments/${row.id}`} className="font-medium text-brand-700 hover:underline">
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
      emptyTitle="No departments yet"
      emptyDescription="Add the choir's first department using the form."
    />
  );
}
