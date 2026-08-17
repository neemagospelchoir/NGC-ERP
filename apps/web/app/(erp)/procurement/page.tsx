import type { Metadata } from "next";
import { auth, expenses, procurement, vendors } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createProcurementRequestAction } from "./actions";
import { ProcurementForm } from "./procurement-form";
import { ProcurementTable } from "./procurement-table";

export const metadata: Metadata = { title: "Procurement — NGC ERP" };

const READ_PERMISSIONS = ["finance.procurement.manage", "finance.expenses.manage"];
const MANAGE_PERMISSION = "finance.procurement.manage";

/**
 * Gated like Vendors/Gate Passes/Assets, NOT always-visible like
 * Contributions/Expenses — Procurement has no self-service angle at all
 * (PRD §7.17's flow runs entirely inside Finance once an expense request
 * is already approved), matching `procurement_requests_select_finance`/
 * `_write_finance` RLS (0014) exactly: read is `finance.procurement.
 * manage` OR `finance.expenses.manage` (an approver who isn't also a
 * procurement manager still needs to see what Procurement is doing with
 * requests they approved), write is `finance.procurement.manage` alone.
 */
export default async function ProcurementPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Procurement" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view procurement.</p>
        </Card>
      </>
    );
  }

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [rows, approvedExpenseRequests, vendorRows] = await Promise.all([
    procurement.listProcurementRequests(supabase),
    canManage ? expenses.listExpenseRequests(supabase, { status: "approved" }) : Promise.resolve([]),
    vendors.listVendors(supabase, { status: "active" }),
  ]);

  const allExpenseRequestIds = new Set(rows.map((r) => r.expenseRequestId));
  approvedExpenseRequests.forEach((r) => allExpenseRequestIds.add(r.id));
  const expenseRequestNumberById = new Map<string, string>();
  await Promise.all(
    Array.from(allExpenseRequestIds).map(async (id) => {
      const match = approvedExpenseRequests.find((r) => r.id === id);
      if (match) {
        expenseRequestNumberById.set(id, match.requestNumber);
        return;
      }
      const found = await expenses.getExpenseRequest(supabase, id);
      if (found) expenseRequestNumberById.set(id, found.requestNumber);
    })
  );

  const expenseRequestOptions = approvedExpenseRequests.map((r) => ({
    value: r.id,
    label: `${r.requestNumber} — ${r.description} (${r.currency} ${r.amount.toLocaleString()})`,
  }));
  const vendorNameById = new Map(vendorRows.map((v) => [v.id, v.name]));

  return (
    <>
      <PageHeader title="Procurement" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <ProcurementTable rows={rows} expenseRequestNumberById={expenseRequestNumberById} vendorNameById={vendorNameById} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Start procurement</CardTitle>
            </CardHeader>
            <ProcurementForm
              action={createProcurementRequestAction}
              expenseRequestOptions={expenseRequestOptions}
              submitLabel="Start procurement"
              pendingLabel="Creating…"
            />
          </Card>
        )}
      </div>
    </>
  );
}
