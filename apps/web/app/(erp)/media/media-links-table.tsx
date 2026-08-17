"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { media } from "@ngc/services";
import { linkTypeLabel } from "./status";

export function MediaLinksTable({ rows, canManage }: { rows: media.MediaLink[]; canManage: boolean }) {
  const columns: TableColumn<media.MediaLink>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) =>
        canManage ? (
          <Link href={`/media/${row.id}`} className="font-medium text-brand-700 hover:underline">
            {row.title ?? row.url}
          </Link>
        ) : (
          <a href={row.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
            {row.title ?? row.url}
          </a>
        ),
    },
    { key: "type", header: "Type", render: (row) => linkTypeLabel(row.linkType) },
    { key: "event", header: "Event", render: (row) => row.eventId ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) => (row.isPublished ? <StatusPill tone="good" label="Published" /> : <StatusPill tone="neutral" label="Draft / shared" />),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No media links yet"
      emptyDescription="Nothing has been posted yet."
    />
  );
}
