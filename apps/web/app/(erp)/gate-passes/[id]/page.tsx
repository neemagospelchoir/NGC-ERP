import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, gatePasses, workflow } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  addGatePassItemAction,
  checkOutGatePassAction,
  decideGatePassApprovalAction,
  markGatePassInTransitAction,
  returnGatePassItemAction,
  submitGatePassForApprovalAction,
} from "../actions";
import { AddGatePassItemForm, ApprovalDecisionForm, ReturnGatePassItemForm, SimpleActionForm } from "../action-form";
import { gatePassStatusLabel, gatePassStatusTone } from "../status";

export const metadata: Metadata = { title: "Gate Pass — NGC ERP" };

const READ_PERMISSION = "inventory.gate_passes.read";
const MANAGE_PERMISSION = "inventory.gate_passes.manage";

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Read access here is intentionally NOT gated by application code beyond
 * the page-level permission check below — `gate_pass_items_select_internal`
 * RLS (0011) lets any signed-in user with either gate-pass permission read
 * every item, and the approval-chain section reuses the exact "trust
 * Postgres" pattern the cross-module Approval Center established
 * (docs/PHASE_7_5.md): `workflow_instances_select_scoped` RLS already
 * narrows what a caller can see to their own pending step or
 * `management.approvals.read_all`.
 */
export default async function GatePassDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(
    currentUser?.permissionCodes.includes(READ_PERMISSION) || currentUser?.permissionCodes.includes(MANAGE_PERMISSION)
  );
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Gate Pass" breadcrumb={["NGC ERP", "Gate Passes"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view gate passes.</p>
        </Card>
      </>
    );
  }

  const gatePass = await gatePasses.getGatePass(supabase, params.id);
  if (!gatePass) notFound();

  const [items, instance] = await Promise.all([
    gatePasses.listGatePassItems(supabase, gatePass.id),
    workflow.getWorkflowForRecord(supabase, "gate_pass", gatePass.id),
  ]);
  const decisions = instance ? await workflow.listWorkflowDecisions(supabase, instance.id) : [];

  const isCurrentApprover = Boolean(
    instance &&
      instance.status === "pending" &&
      currentUser &&
      workflow.isCurrentStepFor(instance, { id: currentUser.id, roleCodes: currentUser.roles.map((r) => r.code) })
  );

  const boundAddItem = addGatePassItemAction.bind(null, gatePass.id);
  const boundSubmit = submitGatePassForApprovalAction.bind(null, gatePass.id);
  const boundDecide = decideGatePassApprovalAction.bind(null, gatePass.id);
  const checkOut = async () => {
    "use server";
    await checkOutGatePassAction(gatePass.id);
  };
  const markInTransit = async () => {
    "use server";
    await markGatePassInTransitAction(gatePass.id);
  };

  const canAddItems = canManage && gatePass.status === "pending_approval" && !instance;
  const canSubmit = canManage && gatePass.status === "pending_approval" && !instance && items.length > 0;
  const canCheckOut = canManage && gatePass.status === "approved";
  const canMarkInTransit = canManage && gatePass.status === "checked_out";
  const canReturnItems = canManage && (gatePass.status === "checked_out" || gatePass.status === "in_transit");

  return (
    <>
      <PageHeader
        title={gatePass.gatePassNumber}
        breadcrumb={["NGC ERP", "Gate Passes"]}
        action={<StatusPill tone={gatePassStatusTone(gatePass.status)} label={gatePassStatusLabel(gatePass.status)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Event</dt>
                <dd className="text-sm text-ink-primary">
                  <Link href={`/events/${gatePass.eventId}`} className="font-medium text-brand-700 hover:underline">
                    View event →
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Person responsible</dt>
                <dd className="text-sm text-ink-primary">{gatePass.personResponsibleId}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Department</dt>
                <dd className="text-sm text-ink-primary">{gatePass.departmentId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">QR token</dt>
                <dd className="font-mono text-xs text-ink-secondary">{gatePass.qrToken}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Expected departure</dt>
                <dd className="text-sm text-ink-primary">
                  {gatePass.expectedDeparture ? new Date(gatePass.expectedDeparture).toLocaleString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Expected return</dt>
                <dd className="text-sm text-ink-primary">
                  {gatePass.expectedReturn ? new Date(gatePass.expectedReturn).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            {items.length === 0 ? (
              <p className="text-sm text-ink-secondary">No items added yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-ink-primary">
                      Asset {item.assetId} — Qty {item.quantity}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {item.checkedOutAt ? `Checked out ${new Date(item.checkedOutAt).toLocaleString()}` : "Not yet checked out"}
                      {item.returnedAt &&
                        ` · Returned ${new Date(item.returnedAt).toLocaleString()} (${labelize(item.returnCondition ?? "")})`}
                    </p>
                    {canReturnItems && !item.returnedAt && (
                      <div className="mt-2 max-w-xs">
                        <ReturnGatePassItemForm action={returnGatePassItemAction.bind(null, gatePass.id, item.id)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canAddItems && (
              <div className="mt-4 border-t border-hairline pt-4">
                <h3 className="mb-3 text-sm font-medium text-ink-primary">Add an item</h3>
                <AddGatePassItemForm action={boundAddItem} />
              </div>
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

        {canManage && (
          <div className="flex flex-col gap-6">
            {canSubmit && (
              <Card>
                <CardHeader>
                  <CardTitle>Submit for approval</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">Begins the configured chain (Technical Manager, then Secretary).</p>
                <SimpleActionForm action={boundSubmit} label="Submit for approval" pendingLabel="Submitting…" />
              </Card>
            )}

            {canCheckOut && (
              <Card>
                <CardHeader>
                  <CardTitle>Check out</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">Marks every item as having left the building.</p>
                <form action={checkOut}>
                  <Button type="submit">Check out</Button>
                </form>
              </Card>
            )}

            {canMarkInTransit && (
              <Card>
                <CardHeader>
                  <CardTitle>In transit</CardTitle>
                </CardHeader>
                <form action={markInTransit}>
                  <Button type="submit" variant="secondary">
                    Mark in transit
                  </Button>
                </form>
              </Card>
            )}
          </div>
        )}

        {isCurrentApprover && (
          <div className="flex flex-col gap-6 lg:col-start-2">
            <Card>
              <CardHeader>
                <CardTitle>Your decision</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                You hold the {instance?.currentStepRoleCode} role and this gate pass is awaiting your decision.
              </p>
              <ApprovalDecisionForm action={boundDecide} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
