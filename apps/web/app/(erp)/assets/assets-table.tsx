"use client";

import Link from "next/link";
import { StatusPill, Table, type TableColumn } from "@ngc/ui";
import type { inventory } from "@ngc/services";

const AVAILABILITY_TONE: Record<inventory.AssetAvailabilityStatus, "good" | "neutral" | "warning" | "critical"> = {
  available: "good",
  assigned: "neutral",
  under_maintenance: "warning",
  missing: "critical",
  disposed: "critical",
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function AssetsTable({ rows, categoryNameById }: { rows: inventory.Asset[]; categoryNameById: Map<string, string> }) {
  const columns: TableColumn<inventory.Asset>[] = [
    {
      key: "assetTag",
      header: "Asset tag",
      render: (row) => (
        <Link href={`/assets/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.assetTag}
        </Link>
      ),
    },
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "category", header: "Category", render: (row) => categoryNameById.get(row.categoryId) ?? "—" },
    { key: "condition", header: "Condition", render: (row) => labelize(row.condition) },
    {
      key: "availability",
      header: "Availability",
      render: (row) => <StatusPill tone={AVAILABILITY_TONE[row.availabilityStatus]} label={labelize(row.availabilityStatus)} />,
    },
    { key: "location", header: "Location", render: (row) => row.location ?? "—" },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyTitle="No assets yet"
      emptyDescription="Add the first asset using the form."
    />
  );
}
