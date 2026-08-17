"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { contributions } from "@ngc/services";

const STATUS_TONE: Record<contributions.CampaignStatus, "good" | "neutral" | "warning" | "critical"> = {
  draft: "neutral",
  active: "good",
  closed: "neutral",
  cancelled: "critical",
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString()}`;
}

export function CampaignsTable({ rows }: { rows: contributions.ContributionCampaign[] }) {
  const columns: TableColumn<contributions.ContributionCampaign>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (row) => (
        <Link href={`/contributions/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "target", header: "Target", render: (row) => formatAmount(row.targetAmount, row.currency) },
    { key: "deadline", header: "Deadline", render: (row) => (row.deadline ? new Date(row.deadline).toLocaleDateString() : "—") },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={STATUS_TONE[row.status]} label={labelize(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No contribution campaigns yet"
      emptyDescription="Start the first campaign using the form."
    />
  );
}
