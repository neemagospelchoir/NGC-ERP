import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listExpenseRequests } from "../../expenses/list";
import type { ExpenseStatus } from "../../expenses/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Expense Report" (PRD §11). Every expense request created in the
 * period — `listExpenseRequests`'s own doc comment already states its
 * scoping: `expense_requests_select_scoped` (0014) narrows this to "your
 * own requests" for anyone without `finance.expenses.manage`/`.approve`,
 * so a plain member's report is exactly their own expense history, the
 * same shape as the Expenses page itself. `filters.status` narrows by
 * `ExpenseStatus`.
 *
 * Deliberately does NOT resolve `requestedBy` to a display name — that id
 * is a `users.id` (any signed-in caller, not necessarily someone with a
 * `members` row), and no existing service function resolves user display
 * names from a bare id list the way `resolveMemberNames` does for member
 * ids; adding one is more than this report needs for a first cut. The
 * request number, description, and amount already identify each row
 * without it.
 */
export async function runExpensesReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const expenses = await listExpenseRequests(client, {
    createdFrom: from,
    createdTo: to,
    status: filters.status as ExpenseStatus | undefined,
  });

  return {
    reportKey: "expenses",
    title: "Expense Report",
    period: { from, to },
    columns: [
      { key: "requestNumber", label: "Request #" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", align: "right" },
      { key: "currency", label: "Currency" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Requested" },
    ],
    rows: expenses.map((e) => ({
      requestNumber: e.requestNumber,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      category: e.category ?? "—",
      status: e.status,
      createdAt: e.createdAt.slice(0, 10),
    })),
  };
}
