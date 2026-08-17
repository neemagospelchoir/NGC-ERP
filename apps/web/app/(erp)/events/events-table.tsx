"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { events } from "@ngc/services";
import { eventStatusLabel, eventStatusTone } from "./status";

export function EventsTable({ rows }: { rows: events.EventSummary[] }) {
  const columns: TableColumn<events.EventSummary>[] = [
    {
      key: "name",
      header: "Event",
      render: (row) => (
        <Link href={`/events/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "eventCategory", header: "Category", render: (row) => row.eventCategory.replace(/_/g, " ") },
    { key: "eventDate", header: "Date", render: (row) => new Date(row.eventDate).toLocaleDateString() },
    { key: "venue", header: "Venue", render: (row) => row.venue ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={eventStatusTone(row.status)} label={eventStatusLabel(row.status)} />,
    },
  ];

  return <Table columns={columns} rows={rows} rowKey={(row) => row.id} emptyTitle="No events found" emptyDescription="No events match the current filter." />;
}
