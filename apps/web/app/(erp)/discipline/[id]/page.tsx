import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, discipline } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { advanceCaseStatusAction, recordActionAction, restoreSuspensionAction } from "../actions";
import { RecordActionForm, RestoreSuspensionForm, SimpleActionForm } from "../action-form";
import { actionTypeLabel, caseStatusLabel, caseStatusTone } from "../status";

export const metadata: Metadata = { title: "Disciplinary case — NGC ERP" };

const READ_PERMISSION = "discipline.cases.read";
const MANAGE_PERMISSION = "discipline.cases.manage";

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

/**
 * `disciplinary_cases_select_discipline_only` RLS (0007) already means a
 * case invisible to the caller comes back as no row at all — but this
 * page checks `canRead` explicitly too, BEFORE ever calling getCase(),
 * rather than relying solely on that RLS result. Same reasoning as the
 * list/new pages' own explicit checks: for a module this confidentiality-
 * sensitive (spec S33/S53 — "no other role sees this by default"), the UI
 * should never even attempt to render a case's contents for a caller with
 * no discipline permission, as a deliberate defense-in-depth belt on top
 * of the RLS suspenders, not a replacement for them.
 */
export default async function DisciplineCaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(
    currentUser?.permissionCodes.includes(READ_PERMISSION) || currentUser?.permissionCodes.includes(MANAGE_PERMISSION)
  );

  if (!canRead) {
    return (
      <>
        <PageHeader title="Disciplinary case" breadcrumb={["NGC ERP", "Discipline"]} />
        <Card>
          <p className="text-sm text-ink-secondary">
            This is a confidential module. You don&apos;t have permission to view this case.
          </p>
        </Card>
      </>
    );
  }

  const caseRecord = await discipline.getCase(supabase, params.id);
  if (!caseRecord) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const actionsList = canManage ? await discipline.listActions(supabase, caseRecord.id) : [];

  const boundBeginInvestigation = advanceCaseStatusAction.bind(null, caseRecord.id, "under_investigation");
  const boundResolve = advanceCaseStatusAction.bind(null, caseRecord.id, "resolved");
  const boundClose = advanceCaseStatusAction.bind(null, caseRecord.id, "closed");
  const boundRecordAction = recordActionAction.bind(null, caseRecord.id);

  return (
    <>
      <PageHeader
        title={caseRecord.caseNumber}
        breadcrumb={["NGC ERP", "Discipline", caseRecord.memberName]}
        action={<StatusPill tone={caseStatusTone(caseRecord.status)} label={caseStatusLabel(caseRecord.status)} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Member", caseRecord.memberName],
                ["Member number", caseRecord.memberNumber],
                ["Category", caseRecord.category],
                ["Incident date", new Date(caseRecord.incidentDate).toLocaleDateString()],
                ["Opened", new Date(caseRecord.createdAt).toLocaleString()],
              ]}
            />
            <p className="mt-3 text-sm text-ink-primary">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Description: </span>
              {caseRecord.description}
            </p>
            {canManage && (
              <p className="mt-4 text-sm">
                <Link href={`/members/${caseRecord.memberId}`} className="font-medium text-brand-700 hover:underline">
                  View member record →
                </Link>
              </p>
            )}
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Actions taken</CardTitle>
              </CardHeader>
              {actionsList.length === 0 ? (
                <p className="text-sm text-ink-secondary">No actions have been recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {actionsList.map((a) => (
                    <li key={a.id} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-primary">{actionTypeLabel(a.actionType)}</p>
                      <p className="text-xs text-ink-muted">{new Date(a.decidedAt).toLocaleString()}</p>
                      {a.actionType === "suspension" && (
                        <p className="mt-1 text-sm text-ink-secondary">
                          {a.suspensionStartDate} → {a.suspensionEndDate ?? "open-ended"}
                          {a.restoredAt ? ` — restored ${new Date(a.restoredAt).toLocaleDateString()}` : ""}
                        </p>
                      )}
                      {a.resolution && <p className="mt-1 text-sm text-ink-primary">{a.resolution}</p>}
                      {a.restorationReason && (
                        <p className="mt-1 text-sm text-ink-secondary">
                          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Restoration reason: </span>
                          {a.restorationReason}
                        </p>
                      )}
                      {a.actionType === "suspension" && !a.restoredAt && (
                        <div className="mt-3">
                          <RestoreSuspensionForm action={restoreSuspensionAction.bind(null, a.id, caseRecord.id)} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            {caseRecord.status === "open" && (
              <Card>
                <CardHeader>
                  <CardTitle>Begin investigation</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundBeginInvestigation} label="Begin investigation" pendingLabel="Moving…" />
              </Card>
            )}

            {(caseRecord.status === "open" || caseRecord.status === "under_investigation") && (
              <Card>
                <CardHeader>
                  <CardTitle>Record decision</CardTitle>
                </CardHeader>
                <RecordActionForm action={boundRecordAction} />
              </Card>
            )}

            {caseRecord.status === "action_decided" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Record another action</CardTitle>
                  </CardHeader>
                  <RecordActionForm action={boundRecordAction} />
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Resolve case</CardTitle>
                  </CardHeader>
                  <p className="mb-3 text-sm text-ink-secondary">Marks the case resolved — the decided action(s) above stand as the record.</p>
                  <SimpleActionForm action={boundResolve} label="Mark resolved" pendingLabel="Resolving…" />
                </Card>
              </>
            )}

            {caseRecord.status === "resolved" && (
              <Card>
                <CardHeader>
                  <CardTitle>Close case</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">Closing is final — no further actions can be recorded against this case.</p>
                <SimpleActionForm action={boundClose} label="Close case" pendingLabel="Closing…" />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
