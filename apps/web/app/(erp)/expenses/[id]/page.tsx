import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, expenses, workflow } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  closeExpenseRequestAction,
  decideExpenseRequestApprovalAction,
  markExpensePaidAction,
  submitExpenseRequestForApprovalAction,
  updateExpenseRequestAction,
} from "../actions";
import { ApprovalDecisionForm, MarkPaidForm, SimpleActionForm } from "../action-form";
import { ExpenseForm } from "../expense-form";
import { expenseStatusLabel, expenseStatusTone } from "../status";

export const metadata: Metadata = { title: "Expense request — NGC ERP" };

const MANAGE_PERMISSION = "finance.expenses.manage";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * No explicit read-permission branch here, unlike Gate Passes' detail page
 * — `expense_requests_select_scoped` RLS (0014) already returns nothing for
 * a caller who is neither the requester nor holds `finance.expenses.
 * manage`/`.approve`, so `getExpenseRequest` naturally returns `null` for
 * them and this page 404s exactly as it would for a nonexistent id. This
 * mirrors Leave's own detail page (`/leave/[id]`), which relies on the
 * identical shape of self-row-or-permission RLS the same way, rather than
 * gate-passes' explicit "you don't have permission" branch (Gate Passes has
 * no self-service read angle at all, so it needs one; Expenses does).
 */
export default async function ExpenseRequestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [request, categories] = await Promise.all([
    expenses.getExpenseRequest(supabase, params.id),
    expenses.listExpenseCategories(supabase),
  ]);
  if (!request) notFound();
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));

  const isOwner = Boolean(currentUser && currentUser.id === request.requestedBy);
  const canEdit = isOwner && request.status === "draft";
  const canSubmit = isOwner && request.status === "draft";
  const canMarkPaid = canManage && request.status === "approved";
  const canClose = canManage && request.status === "paid";

  const instance = await workflow.getWorkflowForRecord(supabase, "expense_request", request.id);
  const decisions = instance ? await workflow.listWorkflowDecisions(supabase, instance.id) : [];
  const isCurrentApprover = Boolean(
    instance &&
      instance.status === "pending" &&
      currentUser &&
      workflow.isCurrentStepFor(instance, { id: currentUser.id, roleCodes: currentUser.roles.map((r) => r.code) })
  );

  const boundUpdate = updateExpenseRequestAction.bind(null, request.id);
  const boundSubmit = submitExpenseRequestForApprovalAction.bind(null, request.id);
  const boundDecide = decideExpenseRequestApprovalAction.bind(null, request.id);
  const boundMarkPaid = markExpensePaidAction.bind(null, request.id);
  const close = async () => {
    "use server";
    await closeExpenseRequestAction(request.id);
  };

  return (
    <>
      <PageHeader
        title={request.requestNumber}
        breadcrumb={["NGC ERP", "Expenses"]}
        action={<StatusPill tone={expenseStatusTone(request.status)} label={expenseStatusLabel(request.status)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            {canEdit ? (
              <ExpenseForm action={boundUpdate} categoryOptions={categoryOptions} initial={request} submitLabel="Save changes" pendingLabel="Saving…" />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Description</dt>
                  <dd className="text-sm text-ink-primary">{request.description}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Amount</dt>
                  <dd className="text-sm text-ink-primary">{formatAmount(request.amount, request.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Category</dt>
                  <dd className="text-sm text-ink-primary">{request.category ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Payment reference</dt>
                  <dd className="text-sm text-ink-primary">{request.paymentReference ?? "—"}</dd>
                </div>
                {request.status !== "draft" && isOwner && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Editing</dt>
                    <dd className="text-sm text-ink-primary">A request can only be edited while it is still a draft.</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {instance && (
            <Card>
              <CardHeader>
                <CardTitle>Approval chain — {instance.definitionName}</CardTitle>
              </CardHeader>
              {decisions.length === 0 ? (
                <p className="text-sm text-ink-secondary">No decisions recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {decisions.map((d) => (
                    <li key={d.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-primary">
                        Step {d.stepOrder} ({d.approverRoleCode ?? "assigned approver"}) — {d.decision.replace("_", " ")}
                      </p>
                      <p className="text-xs text-ink-muted">{new Date(d.decidedAt).toLocaleString()}</p>
                      {d.comment && <p className="mt-1 text-sm text-ink-secondary">{d.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {instance.status === "pending" && (
                <p className="mt-3 text-sm text-ink-secondary">
                  Currently awaiting step {instance.currentStepOrder}
                  {instance.currentStepRoleCode ? ` (${instance.currentStepRoleCode})` : ""}.
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {canSubmit && (
            <Card>
              <CardHeader>
                <CardTitle>Submit for approval</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">Begins the configured chain (Finance Manager, then Secretary, then Chairman).</p>
              <SimpleActionForm action={boundSubmit} label="Submit for approval" pendingLabel="Submitting…" />
            </Card>
          )}

          {isCurrentApprover && (
            <Card>
              <CardHeader>
                <CardTitle>Your decision</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                You hold the {instance?.currentStepRoleCode} role and this request is awaiting your decision.
              </p>
              <ApprovalDecisionForm action={boundDecide} />
            </Card>
          )}

          {canMarkPaid && (
            <Card>
              <CardHeader>
                <CardTitle>Mark paid</CardTitle>
              </CardHeader>
              <MarkPaidForm action={boundMarkPaid} />
            </Card>
          )}

          {canClose && (
            <Card>
              <CardHeader>
                <CardTitle>Close</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">Closes this request once Procurement (if any) has finished acting on it.</p>
              <form action={close}>
                <Button type="submit" variant="secondary" size="sm">
                  Close request
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
