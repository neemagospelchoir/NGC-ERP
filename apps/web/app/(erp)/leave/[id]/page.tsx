import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, leave } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { decideLeaveRequestAction } from "../actions";
import { LeaveDecideForm } from "../leave-form";
import { leaveStatusLabel, leaveStatusTone, leaveTypeLabel } from "../status";

export const metadata: Metadata = { title: "Leave request — NGC ERP" };

const MANAGE_PERMISSION = "attendance.leave.manage";

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

export default async function LeaveRequestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [request, currentUser] = await Promise.all([
    leave.getLeaveRequest(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!request) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const boundApprove = decideLeaveRequestAction.bind(null, request.id, "approved");
  const boundReject = decideLeaveRequestAction.bind(null, request.id, "rejected");

  return (
    <>
      <PageHeader
        title={request.memberName}
        breadcrumb={["NGC ERP", "Leave", request.memberNumber]}
        action={<StatusPill tone={leaveStatusTone(request.status)} label={leaveStatusLabel(request.status)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
          </CardHeader>
          <FieldGrid
            fields={[
              ["Type", leaveTypeLabel(request.leaveType)],
              ["Start date", new Date(request.startDate).toLocaleDateString()],
              ["End date", new Date(request.endDate).toLocaleDateString()],
              ["Decided by", request.approvedBy ?? "—"],
              ["Decided at", request.approvedAt ? new Date(request.approvedAt).toLocaleString() : "—"],
            ]}
          />
          <p className="mt-3 text-sm text-ink-primary">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Reason: </span>
            {request.reason}
          </p>
          {request.approverComment && (
            <p className="mt-3 text-sm text-ink-primary">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Approver comment: </span>
              {request.approverComment}
            </p>
          )}
        </Card>

        {canManage && request.status === "pending" && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-4">
                <LeaveDecideForm action={boundApprove} label="Approve" pendingLabel="Approving…" />
                <LeaveDecideForm action={boundReject} label="Reject" pendingLabel="Rejecting…" variant="destructive" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
