"use client";

import Link from "next/link";
import { Table, type TableColumn } from "@ngc/ui";
import type { technicalRiders } from "@ngc/services";

/**
 * A dedicated client component, not columns built inline in the (Server
 * Component) page — `Table`'s `columns` prop carries `render` functions,
 * and Next's App Router cannot serialize a plain function across the
 * server/client boundary unless it's a Server Action. Mirrors
 * `GatePassTable`/`UniformsTable`'s exact shape (docs/PHASE_8_1.md,
 * docs/PHASE_8_2.md) — the first attempt at this page built columns
 * directly in the server page component and failed at runtime with
 * "Functions cannot be passed directly to Client Components," caught by
 * this phase's own e2e run.
 */
export function TechnicalRidersTable({ rows }: { rows: technicalRiders.TechnicalRider[] }) {
  const columns: TableColumn<technicalRiders.TechnicalRider>[] = [
    {
      key: "eventId",
      header: "Event",
      render: (row) => (
        <Link href={`/technical-riders/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.eventId}
        </Link>
      ),
    },
    {
      key: "setupTime",
      header: "Setup time",
      render: (row) => (row.setupTime ? new Date(row.setupTime).toLocaleString() : "—"),
    },
    {
      key: "soundcheckTime",
      header: "Soundcheck time",
      render: (row) => (row.soundcheckTime ? new Date(row.soundcheckTime).toLocaleString() : "—"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No technical riders yet"
      emptyDescription="Create one from the form once an event needs its technical requirements documented."
    />
  );
}
