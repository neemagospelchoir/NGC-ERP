"use client";

import * as React from "react";
import { cn } from "../utils/cn";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Right-aligns + applies tabular-nums, for numeric/monetary columns. */
  numeric?: boolean;
  sortable?: boolean;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
}

/**
 * Dense, hairline-divided table (no zebra banding — spec S5's "institutional,
 * not flashy" read). Ships its own loading skeleton and empty state so no
 * module screen has to hand-roll either (spec S67).
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyTitle = "No records yet",
  emptyDescription,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary",
                  col.numeric && "text-right"
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.key)}
                    className="inline-flex items-center gap-1 hover:text-ink-primary"
                    aria-sort={
                      sortKey === col.key
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {col.header}
                    <span aria-hidden="true" className="text-[10px]">
                      {sortKey === col.key ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-hairline last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3">
                    <div className="h-3 w-full max-w-[160px] animate-pulse rounded-sm bg-ink-muted/15" />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-hairline last:border-0",
                  onRowClick && "cursor-pointer hover:bg-brand-50"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-2.5 text-ink-primary", col.numeric && "text-right tabular-nums")}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {!isLoading && rows.length === 0 && (
        <div className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      )}
    </div>
  );
}
