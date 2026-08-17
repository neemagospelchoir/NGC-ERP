"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import type { workflow } from "@ngc/services";
import { ApprovalDecisionForm } from "../invitations/action-form";
import { recordInvitationApprovalDecisionAction } from "../invitations/actions";

export interface ApprovalRowData {
  instance: workflow.WorkflowInstanceSummary;
  label: string;
  href: string | null;
  isMyStep: boolean;
}

/**
 * One row per pending `workflow_instances` — the same generic query
 * (`workflow.listMyPendingApprovals`) every future approvable record type
 * will share (ARCHITECTURE.md §12). Only `record_type: 'invitation'` has
 * a real decision action wired up today; anything else renders as a
 * read-only placeholder (there is no module behind it yet to react to a
 * decision — see docs/PHASE_7_5.md §1).
 */
export function ApprovalRow({ row }: { row: ApprovalRowData }) {
  const { instance, label, href, isMyStep } = row;
  const boundDecide =
    instance.recordType === "invitation" ? recordInvitationApprovalDecisionAction.bind(null, instance.recordId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {href ? (
            <Link href={href} className="text-brand-700 hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </CardTitle>
      </CardHeader>
      <p className="mb-3 text-sm text-ink-secondary">
        {instance.definitionName} — step {instance.currentStepOrder}
        {instance.currentStepRoleCode ? ` (${instance.currentStepRoleCode})` : ""}
      </p>
      {isMyStep && boundDecide ? (
        <ApprovalDecisionForm action={boundDecide} />
      ) : (
        <p className="text-sm text-ink-muted">
          {boundDecide ? "Awaiting a different approver's decision." : "This record type isn't wired to a decision action yet."}
        </p>
      )}
    </Card>
  );
}
