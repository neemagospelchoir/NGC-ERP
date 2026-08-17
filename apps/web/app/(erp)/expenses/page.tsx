import type { Metadata } from "next";
import Link from "next/link";
import { auth, expenses } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createExpenseRequestAction } from "./actions";
import { ExpenseForm } from "./expense-form";
import { ExpensesTable } from "./expenses-table";
import { expenseStatusLabel, expenseStatusTone } from "./status";

export const metadata: Metadata = { title: "Expenses — NGC ERP" };

const MANAGE_PERMISSION = "finance.expenses.manage";
const APPROVE_PERMISSION = "finance.expenses.approve";

/**
 * Always visible, the same "everyone has a real reason to be here" shape
 * as Attendance & Leave (not Gate Passes/Vendors, which have no self-service
 * angle at all) — `expense_requests_insert_self`/`_select_scoped` RLS
 * (0014) let ANY signed-in user create and read their OWN requests, matching
 * PRD §6's "Dept Leader/Choir Member: Create (own), Read (own)" exactly.
 * The full cross-member list below is additionally shown to anyone holding
 * `finance.expenses.manage` OR `finance.expenses.approve`, matching the
 * RLS policy's broader clause — not gated on `.manage` alone, since an
 * approver who isn't also a manager still needs to see every request
 * awaiting a decision, the same reasoning as Contributions' `.manage`/
 * `.read` either-or gate (docs/PHASE_9_1.md §3).
 */
export default async function ExpensesPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canReadAll = Boolean(
    currentUser?.permissionCodes.includes(MANAGE_PERMISSION) || currentUser?.permissionCodes.includes(APPROVE_PERMISSION)
  );

  const [categories, myRequests, allRequests] = await Promise.all([
    expenses.listExpenseCategories(supabase),
    currentUser ? expenses.listExpenseRequestsForRequester(supabase, currentUser.id) : Promise.resolve([]),
    canReadAll ? expenses.listExpenseRequests(supabase) : Promise.resolve([]),
  ]);
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));

  return (
    <>
      <PageHeader title="Expenses" breadcrumb={["NGC ERP"]} />

      {currentUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My expense requests</CardTitle>
          </CardHeader>
          {myRequests.length === 0 ? (
            <p className="text-sm text-ink-secondary">You have no expense requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {myRequests.map((r) => (
                <li key={r.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                  <Link href={`/expenses/${r.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {r.requestNumber} — {r.description}
                  </Link>
                  <p className="mt-1 text-xs text-ink-muted">
                    {r.currency} {r.amount.toLocaleString()} ·{" "}
                    <StatusPill tone={expenseStatusTone(r.status)} label={expenseStatusLabel(r.status)} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {canReadAll ? (
          <ExpensesTable rows={allRequests} />
        ) : (
          <Card>
            <p className="text-sm text-ink-secondary">Your own expense requests are listed above. Finance staff can see every request here.</p>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>New expense request</CardTitle>
          </CardHeader>
          <ExpenseForm action={createExpenseRequestAction} categoryOptions={categoryOptions} submitLabel="Create request" pendingLabel="Creating…" />
        </Card>
      </div>
    </>
  );
}
