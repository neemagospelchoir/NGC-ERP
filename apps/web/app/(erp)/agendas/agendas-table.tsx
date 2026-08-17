"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { agendas } from "@ngc/services";
import { eligibleVoterScopeLabel, statusLabel, statusTone } from "./status";

export function AgendasTable({ rows }: { rows: agendas.Agenda[] }) {
  const columns: TableColumn<agendas.Agenda>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <Link href={`/agendas/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "scope", header: "Who can vote", render: (row) => eligibleVoterScopeLabel(row.eligibleVoterScope) },
    { key: "anonymous", header: "Anonymous", render: (row) => (row.isAnonymous ? "Yes" : "No") },
    { key: "deadline", header: "Voting deadline", render: (row) => new Date(row.votingDeadline).toLocaleString() },
    { key: "status", header: "Status", render: (row) => <StatusPill tone={statusTone(row.status)} label={statusLabel(row.status)} /> },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No agenda items yet"
      emptyDescription="Nothing has been put to a vote yet."
    />
  );
}
