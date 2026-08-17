"use client";

import Link from "next/link";
import { Table, type TableColumn } from "@ngc/ui";
import type { playlists } from "@ngc/services";

/**
 * A dedicated client component, not columns built inline in the (Server
 * Component) page — see `TechnicalRidersTable`'s doc comment
 * (docs/PHASE_8_4.md) for why: `Table`'s `columns` prop carries `render`
 * functions, which cannot cross the server/client boundary as a plain prop.
 */
export function PlaylistsTable({
  rows,
  canManage,
}: {
  rows: playlists.Playlist[];
  canManage: boolean;
}) {
  const columns: TableColumn<playlists.Playlist>[] = [
    {
      key: "title",
      header: "Playlist",
      render: (row) => (
        <Link href={`/playlists/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "eventId", header: "Event", render: (row) => row.eventId },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No playlists yet"
      emptyDescription={
        canManage
          ? "Create one from the form once an event needs its song lineup planned."
          : "You are not currently listed as a participant on any event with a playlist."
      }
    />
  );
}
