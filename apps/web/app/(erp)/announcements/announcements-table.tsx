"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { announcements } from "@ngc/services";
import { priorityLabel, priorityTone, targetAudienceLabel } from "./status";

function isLive(row: announcements.Announcement): boolean {
  const now = Date.now();
  const publishAt = new Date(row.publishAt).getTime();
  const expiryAt = row.expiryAt ? new Date(row.expiryAt).getTime() : null;
  return publishAt <= now && (expiryAt === null || expiryAt > now);
}

export function AnnouncementsTable({ rows, canManage }: { rows: announcements.Announcement[]; canManage: boolean }) {
  const columns: TableColumn<announcements.Announcement>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) =>
        canManage ? (
          <Link href={`/announcements/${row.id}`} className="font-medium text-brand-700 hover:underline">
            {row.title}
          </Link>
        ) : (
          <span className="font-medium text-ink-primary">{row.title}</span>
        ),
    },
    { key: "message", header: "Message", render: (row) => <span className="line-clamp-2">{row.message}</span> },
    { key: "audience", header: "Audience", render: (row) => targetAudienceLabel(row.targetAudience) },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <StatusPill tone={priorityTone(row.priority)} label={priorityLabel(row.priority)} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        isLive(row) ? (
          <StatusPill tone="good" label="Live" />
        ) : new Date(row.publishAt).getTime() > Date.now() ? (
          <StatusPill tone="neutral" label="Scheduled" />
        ) : (
          <StatusPill tone="neutral" label="Expired" />
        ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No announcements yet"
      emptyDescription="Nothing has been published yet."
    />
  );
}
