"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { invitations } from "@ngc/services";
import { invitationStatusLabel, invitationStatusTone } from "./status";

export function InvitationsTable({ rows }: { rows: invitations.InvitationSummary[] }) {
  const columns: TableColumn<invitations.InvitationSummary>[] = [
    {
      key: "invitationNumber",
      header: "Invitation #",
      render: (row) => (
        <Link href={`/invitations/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.invitationNumber}
        </Link>
      ),
    },
    { key: "eventName", header: "Event", render: (row) => row.eventName },
    { key: "organizerName", header: "Organizer", render: (row) => row.organizerName },
    { key: "proposedDate", header: "Proposed date", render: (row) => new Date(row.proposedDate).toLocaleDateString() },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={invitationStatusTone(row.status)} label={invitationStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No invitations found"
      emptyDescription="No invitations match the current filter."
    />
  );
}
