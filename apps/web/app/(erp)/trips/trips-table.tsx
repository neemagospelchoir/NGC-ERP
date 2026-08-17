"use client";

import Link from "next/link";
import { Table, type TableColumn } from "@ngc/ui";
import type { trips } from "@ngc/services";

/**
 * A dedicated client component, not columns built inline in the (Server
 * Component) page — see `TechnicalRidersTable`'s doc comment
 * (docs/PHASE_8_4.md) for why: `Table`'s `columns` prop carries `render`
 * functions, which cannot cross the server/client boundary as a plain prop.
 */
export function TripsTable({ rows }: { rows: trips.Trip[] }) {
  const columns: TableColumn<trips.Trip>[] = [
    {
      key: "destination",
      header: "Trip",
      render: (row) => (
        <Link href={`/trips/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.destination ?? row.eventId}
        </Link>
      ),
    },
    { key: "eventId", header: "Event", render: (row) => row.eventId },
    {
      key: "departureAt",
      header: "Departure",
      render: (row) => (row.departureAt ? new Date(row.departureAt).toLocaleString() : "—"),
    },
    {
      key: "estimatedCost",
      header: "Estimated cost",
      render: (row) => (row.estimatedCost !== null ? `${row.estimatedCost.toLocaleString()} ${row.currency}` : "—"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No trips yet"
      emptyDescription="Create one from the form once an event needs transportation planned."
    />
  );
}
