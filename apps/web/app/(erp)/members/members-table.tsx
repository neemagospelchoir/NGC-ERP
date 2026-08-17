"use client";

import Link from "next/link";
import { Avatar, StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { members } from "@ngc/services";
import { membershipStatusLabel, membershipStatusTone } from "./status";

/** See departments/departments-table.tsx's doc comment for why this table's column definitions (and their render closures) must live in a Client Component, not the Server Component page that fetches the rows. */
export function MembersTable({ rows }: { rows: members.MemberSummary[] }) {
  const columns: TableColumn<members.MemberSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/members/${row.id}`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
          <Avatar name={row.preferredName ?? `${row.firstName} ${row.lastName}`} size="sm" />
          <span>
            {row.firstName} {row.lastName}
            {row.preferredName && <span className="ml-1 text-ink-muted">“{row.preferredName}”</span>}
          </span>
        </Link>
      ),
    },
    { key: "memberNumber", header: "Member ID", render: (row) => row.memberNumber },
    { key: "department", header: "Department", render: (row) => row.primaryDepartmentName ?? "—" },
    { key: "family", header: "Family", render: (row) => row.familyName ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusPill tone={membershipStatusTone(row.membershipStatus)} label={membershipStatusLabel(row.membershipStatus)} />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No members found"
      emptyDescription="Try adjusting the filters above, or add the first member."
    />
  );
}
