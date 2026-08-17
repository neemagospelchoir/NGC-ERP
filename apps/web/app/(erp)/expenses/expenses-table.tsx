"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { expenses } from "@ngc/services";
import { expenseStatusLabel, expenseStatusTone } from "./status";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function ExpensesTable({ rows }: { rows: expenses.ExpenseRequest[] }) {
  const columns: TableColumn<expenses.ExpenseRequest>[] = [
    {
      key: "requestNumber",
      header: "Request",
      render: (row) => (
        <Link href={`/expenses/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.requestNumber}
        </Link>
      ),
    },
    { key: "description", header: "Description", render: (row) => row.description },
    { key: "amount", header: "Amount", render: (row) => formatAmount(row.amount, row.currency) },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={expenseStatusTone(row.status)} label={expenseStatusLabel(row.status)} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No expense requests yet"
      emptyDescription="Create the first expense request using the form."
    />
  );
}
