"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { uniforms } from "@ngc/services";

const CONDITION_TONE: Record<uniforms.UniformCondition, "good" | "neutral" | "warning" | "critical"> = {
  new: "good",
  good: "good",
  fair: "neutral",
  poor: "warning",
  retired: "critical",
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function UniformsTable({ rows, categoryLabelByCode }: { rows: uniforms.Uniform[]; categoryLabelByCode: Map<string, string> }) {
  const columns: TableColumn<uniforms.Uniform>[] = [
    {
      key: "uniformType",
      header: "Type",
      render: (row) => (
        <Link href={`/uniforms/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {categoryLabelByCode.get(row.uniformType) ?? labelize(row.uniformType)}
        </Link>
      ),
    },
    { key: "size", header: "Size", render: (row) => row.size ?? "—" },
    { key: "available", header: "Available", render: (row) => `${row.quantityAvailable} / ${row.quantityTotal}` },
    {
      key: "condition",
      header: "Condition",
      render: (row) => <StatusPill tone={CONDITION_TONE[row.condition]} label={labelize(row.condition)} />,
    },
    { key: "location", header: "Location", render: (row) => row.storageLocation ?? "—" },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No uniforms registered yet"
      emptyDescription="Add the first uniform type using the form."
    />
  );
}
