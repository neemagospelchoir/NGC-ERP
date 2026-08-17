"use client";

import { Button, StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { contributions } from "@ngc/services";

const STATUS_TONE: Record<contributions.ContributionStatus, "good" | "neutral" | "warning" | "critical"> = {
  pending: "neutral",
  confirmed: "good",
  reversed: "critical",
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * `reverseActions` is a map of already server-side-bound
 * `reverseContributionAction.bind(null, campaignId, record.id)` references,
 * one per row, built by the (Server Component) page and passed down as a
 * prop — mirroring Attendance's `RosterTable`'s `actions: Record<string,
 * ...>` convention exactly. A bound Server Action reference is safe to pass
 * as a Client Component prop (unlike an arbitrary closure, which is not);
 * this table never constructs the action itself, only looks it up by row id
 * and wires it straight into `<form action={...}>`. Undefined for a caller
 * without `finance.contributions.manage` — the page never renders a reverse
 * control it can't back, matching `contribution_records_write_finance` RLS
 * (0014), which grants no self-reversal path at all.
 */
export function ContributionRecordsTable({
  rows,
  reverseActions,
}: {
  rows: contributions.ContributionRecord[];
  reverseActions?: Record<string, () => Promise<void>>;
}) {
  const columns: TableColumn<contributions.ContributionRecord>[] = [
    { key: "member", header: "Member", render: (row) => row.memberId },
    { key: "amount", header: "Amount", render: (row) => formatAmount(row.amount, row.currency) },
    { key: "date", header: "Date", render: (row) => new Date(row.contributedAt).toLocaleDateString() },
    { key: "method", header: "Method", render: (row) => (row.paymentMethod ? labelize(row.paymentMethod) : "—") },
    { key: "reference", header: "Reference", render: (row) => row.reference ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={STATUS_TONE[row.status]} label={labelize(row.status)} />,
    },
    ...(reverseActions
      ? [
          {
            key: "actions",
            header: "",
            render: (row: contributions.ContributionRecord) => {
              const boundReverse = reverseActions[row.id];
              return row.status === "confirmed" && boundReverse ? (
                <form action={boundReverse}>
                  <Button type="submit" variant="destructive" size="sm">
                    Reverse
                  </Button>
                </form>
              ) : (
                "—"
              );
            },
          } as TableColumn<contributions.ContributionRecord>,
        ]
      : []),
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No contributions recorded yet"
      emptyDescription="Record the first contribution using the form."
    />
  );
}
