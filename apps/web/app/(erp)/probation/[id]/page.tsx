import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, probation } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { completeProbationAction, failProbationAction } from "../actions";
import { ProbationDecisionForm } from "../action-form";
import { probationStatusLabel, probationStatusTone } from "../status";

export const metadata: Metadata = { title: "Probation record — NGC ERP" };

const MANAGE_PERMISSION = "members.applications.manage";

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
          <dd className="text-sm text-ink-primary">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ProbationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [record, currentUser] = await Promise.all([
    probation.getProbation(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!record) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = record.status === "active" && record.deadline < today;

  const boundComplete = completeProbationAction.bind(null, record.id);
  const boundFail = failProbationAction.bind(null, record.id);

  return (
    <>
      <PageHeader
        title={record.memberName}
        breadcrumb={["NGC ERP", "Probation", record.memberNumber]}
        action={<StatusPill tone={probationStatusTone(record.status)} label={probationStatusLabel(record.status)} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Member", record.memberName],
                ["Member number", record.memberNumber],
                ["Started", new Date(record.startedAt).toLocaleDateString()],
                ["Duration", `${record.durationDays} days`],
                ["Deadline", `${new Date(record.deadline).toLocaleDateString()}${overdue ? " (overdue)" : ""}`],
                ["Decided by", record.decidedBy ?? "—"],
                ["Decided at", record.decidedAt ? new Date(record.decidedAt).toLocaleString() : "—"],
              ]}
            />
            {record.outcomeNotes && (
              <p className="mt-3 text-sm text-ink-primary">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Outcome notes: </span>
                {record.outcomeNotes}
              </p>
            )}
            <p className="mt-4 text-sm">
              <Link href={`/members/${record.memberId}`} className="font-medium text-brand-700 hover:underline">
                View member record →
              </Link>
            </p>
          </Card>
        </div>

        {canManage && record.status === "active" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Complete probation</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                Confirms the member in good standing and moves their membership status to active.
              </p>
              <ProbationDecisionForm
                action={boundComplete}
                fieldLabel="Outcome notes"
                fieldHint="Optional"
                label="Mark completed"
                pendingLabel="Completing…"
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fail probation</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                Records why, and exits the member from active membership. This cannot be undone through this page.
              </p>
              <ProbationDecisionForm
                action={boundFail}
                fieldLabel="Reason (required)"
                required
                label="Mark failed"
                pendingLabel="Recording…"
                variant="destructive"
              />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
