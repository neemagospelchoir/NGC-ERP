import type { Metadata } from "next";
import { auth, invitations, workflow } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { ApprovalRow, type ApprovalRowData } from "./approval-row";

export const metadata: Metadata = { title: "Approval Center — NGC ERP" };

/**
 * PRD §7.29/§9.5: "a single Approval Center showing everything awaiting
 * my decision across modules." `workflow.listMyPendingApprovals()` is
 * meant to already return only what `workflow_instances_select_scoped`
 * RLS (0019) lets the caller see (their own pending step, or
 * `management.approvals.read_all`) — but this page re-applies that exact
 * same filter in the application layer too, rather than trusting the
 * query's result set unconditionally. That is deliberate belt-and-
 * suspenders, same as Discipline's page-level guards: the e2e mock server
 * (apps/web/e2e/mock-gotrue-server.mjs) does not simulate RLS row-scoping
 * at all — its generic GET handler returns every row matching the
 * PostgREST filter regardless of who's asking — so without this
 * re-check, ANY signed-in user would see every pending approval, across
 * every step and role, whenever this app runs against the mock. Against
 * the real database this filter is a no-op (RLS already narrowed the
 * result set identically); against the mock it is the only thing that
 * makes this page's access control meaningful for testing at all.
 *
 * Today this is exclusively Invitations — Expenses/Gate Passes/
 * Applications/Procurement aren't wired to the engine yet (docs/
 * PHASE_7_5.md §1) — but the page itself is generic, per
 * ARCHITECTURE.md §12's "one UI, reused across every approvable record
 * type."
 */
export default async function ApprovalsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);

  if (!currentUser) {
    return (
      <>
        <PageHeader title="Approval Center" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">Sign in to see approvals awaiting your decision.</p>
        </Card>
      </>
    );
  }

  const canReadAll = currentUser.permissionCodes.includes("management.approvals.read_all");
  const roleCodes = currentUser.roles.map((r) => r.code);
  const pending = (await workflow.listMyPendingApprovals(supabase)).filter(
    (instance) => canReadAll || workflow.isCurrentStepFor(instance, { id: currentUser.id, roleCodes })
  );
  const invitationInstances = pending.filter((i) => i.recordType === "invitation");
  const invitationRows = await invitations.listInvitationsByIds(
    supabase,
    invitationInstances.map((i) => i.recordId)
  );
  const invitationByRecordId = new Map(invitationRows.map((inv) => [inv.id, inv]));

  const rows: ApprovalRowData[] = pending.map((instance) => {
    const isMyStep = workflow.isCurrentStepFor(instance, { id: currentUser.id, roleCodes });
    if (instance.recordType === "invitation") {
      const inv = invitationByRecordId.get(instance.recordId);
      return {
        instance,
        label: inv ? `${inv.invitationNumber} — ${inv.eventName}` : "Invitation",
        href: `/invitations/${instance.recordId}`,
        isMyStep,
      };
    }
    return { instance, label: `${instance.recordType} (${instance.recordId})`, href: null, isMyStep };
  });

  return (
    <>
      <PageHeader title="Approval Center" breadcrumb={["NGC ERP"]} />
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-secondary">Nothing is awaiting your decision right now.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <ApprovalRow key={row.instance.id} row={row} />
          ))}
        </div>
      )}
    </>
  );
}
