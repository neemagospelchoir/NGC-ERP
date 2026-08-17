import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { attendance, auth, departments, families, members } from "@ngc/services";
import { Avatar, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  assignDepartmentAction,
  assignFamilyAction,
  updateMemberContactInfoAction,
  updateMemberRecordAction,
} from "../actions";
import { AssignDepartmentForm, AssignFamilyForm, MemberContactForm, MemberRecordForm } from "../member-forms";
import { membershipStatusLabel, membershipStatusTone } from "../status";

export const metadata: Metadata = { title: "Member — NGC ERP" };

const MANAGE_PERMISSION = "members.profiles.manage";

export default async function MemberDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [member, currentUser, attendanceSummary] = await Promise.all([
    members.getMember(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
    attendance.getMemberAttendanceSummary(supabase, params.id),
  ]);
  if (!member) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const isSelf = Boolean(currentUser?.member?.id === member.id);

  const boundUpdateContactInfo = updateMemberContactInfoAction.bind(null, member.id);
  const boundUpdateRecord = updateMemberRecordAction.bind(null, member.id);
  const boundAssignDepartment = assignDepartmentAction.bind(null, member.id);
  const boundAssignFamily = assignFamilyAction.bind(null, member.id);

  let departmentOptions: { value: string; label: string }[] = [];
  let familyOptions: { value: string; label: string }[] = [];
  if (canManage) {
    const [departmentRows, familyRows] = await Promise.all([
      departments.listDepartments(supabase),
      families.listFamilies(supabase),
    ]);
    departmentOptions = departmentRows.map((d) => ({ value: d.id, label: d.name }));
    familyOptions = familyRows.map((f) => ({ value: f.id, label: f.name }));
  }

  return (
    <>
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        breadcrumb={["NGC ERP", "Members"]}
        action={<StatusPill tone={membershipStatusTone(member.membershipStatus)} label={membershipStatusLabel(member.membershipStatus)} />}
      />
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={member.preferredName ?? `${member.firstName} ${member.lastName}`} size="lg" />
        <div>
          <p className="text-sm text-ink-secondary">Member ID: {member.memberNumber}</p>
          <p className="text-sm text-ink-secondary">
            Department: {member.primaryDepartmentName ?? "—"} · Family: {member.familyName ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{canManage ? "Member record" : "Contact details"}</CardTitle>
            </CardHeader>
            {canManage ? (
              <MemberRecordForm action={boundUpdateRecord} member={member} />
            ) : isSelf ? (
              <MemberContactForm action={boundUpdateContactInfo} member={member} />
            ) : (
              <ReadOnlyContactInfo member={member} />
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            {attendanceSummary.sessionsRecorded === 0 ? (
              <p className="text-sm text-ink-secondary">No attendance has been recorded for this member yet.</p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Attendance %</dt>
                  <dd className="text-lg font-semibold text-ink-primary">{attendanceSummary.attendancePercentage}%</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Present</dt>
                  <dd className="text-sm text-ink-primary">{attendanceSummary.sessionsPresent}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Sessions recorded</dt>
                  <dd className="text-sm text-ink-primary">{attendanceSummary.sessionsRecorded}</dd>
                </div>
              </dl>
            )}
          </Card>
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Reassign department</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                Every change here is recorded in the department assignment history — nothing is overwritten.
              </p>
              <AssignDepartmentForm action={boundAssignDepartment} departmentOptions={departmentOptions} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Reassign family</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                Every change here is recorded in the family assignment history — nothing is overwritten.
              </p>
              <AssignFamilyForm action={boundAssignFamily} familyOptions={familyOptions} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Neither the record-manager nor the self-service form is safe to show: the
 * viewer isn't this member and doesn't hold members.profiles.manage. RLS
 * (members_select_scoped) already decided this row is visible to them at
 * all (e.g. same-department scope) — read-only display, no edit affordance
 * that would just be rejected by the DB trigger/RLS on submit anyway.
 */
function ReadOnlyContactInfo({ member }: { member: members.MemberDetail }) {
  const rows: [string, string][] = [
    ["Preferred name", member.preferredName ?? "—"],
    ["Email", member.email ?? "—"],
    ["Phone", member.phone ?? "—"],
    ["WhatsApp", member.whatsappNumber ?? "—"],
    ["Region", member.region ?? "—"],
    ["District", member.district ?? "—"],
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
          <dd className="text-sm text-ink-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
