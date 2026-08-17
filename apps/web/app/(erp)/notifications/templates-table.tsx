"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { notifications } from "@ngc/services";
import { channelLabel } from "./status";

export function TemplatesTable({ rows }: { rows: notifications.NotificationTemplate[] }) {
  const columns: TableColumn<notifications.NotificationTemplate>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/notifications/templates/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "code", header: "Code", render: (row) => <code className="text-xs">{row.code}</code> },
    { key: "channel", header: "Default channel", render: (row) => channelLabel(row.defaultChannels[0] ?? "in_app") },
    {
      key: "status",
      header: "Status",
      render: (row) => (row.isActive ? <StatusPill tone="good" label="Active" /> : <StatusPill tone="neutral" label="Inactive" />),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No templates yet"
      emptyDescription="Create the first notification template using the form."
    />
  );
}
