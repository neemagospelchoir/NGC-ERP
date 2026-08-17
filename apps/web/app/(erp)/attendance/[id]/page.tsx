import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { attendance, auth } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { recordAttendanceAction, type AttendanceActionState } from "../actions";
import { RosterTable } from "../roster-table";
import { sessionTypeLabel } from "../status";

export const metadata: Metadata = { title: "Attendance session — NGC ERP" };

const MANAGE_PERMISSION = "attendance.records.manage";

export default async function AttendanceSessionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [session, currentUser] = await Promise.all([
    attendance.getSession(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!session) notFound();

  // Mirrors `attendance_write_scoped` RLS (0006) exactly: a global
  // attendance.records.manage holder can mark any session; a
  // department-scoped role only covers a session actually scoped to that
  // same department — a whole-choir session (departmentId === null) is
  // never covered by a department-scoped role, on either side.
  const canManage = Boolean(
    currentUser?.permissionCodes.includes(MANAGE_PERMISSION) ||
      (session.departmentId &&
        currentUser?.roles.some((r) => r.scopeType === "department" && r.scopeId === session.departmentId))
  );

  const [roster, statusOptions] = canManage
    ? await Promise.all([attendance.getSessionRoster(supabase, session.id), attendance.listAttendanceStatuses(supabase)])
    : [[], []];

  const actionsByMember: Record<string, (prevState: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>> = {};
  for (const entry of roster) {
    actionsByMember[entry.memberId] = recordAttendanceAction.bind(null, session.id, entry.memberId);
  }

  return (
    <>
      <PageHeader
        title={session.title}
        breadcrumb={["NGC ERP", "Attendance", sessionTypeLabel(session.sessionType)]}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session details</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Type</dt>
              <dd className="text-sm text-ink-primary">{sessionTypeLabel(session.sessionType)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Department</dt>
              <dd className="text-sm text-ink-primary">{session.departmentName ?? "Whole choir"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Date</dt>
              <dd className="text-sm text-ink-primary">{new Date(session.sessionDate).toLocaleDateString()}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          {canManage ? (
            <RosterTable entries={roster} actions={actionsByMember} statusOptions={statusOptions} />
          ) : (
            <p className="text-sm text-ink-secondary">
              You don&apos;t have permission to mark attendance for this session.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
