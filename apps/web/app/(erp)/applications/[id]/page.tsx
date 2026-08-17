import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applications, auth, departments, families } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  advanceApplicationStatusAction,
  convertApplicationToMemberAction,
  decideApplicationAction,
  markApplicationIncompleteAction,
} from "../actions";
import { ReasonActionForm, SimpleActionForm } from "../action-form";
import { ConvertForm } from "../convert-form";
import { applicationStatusLabel, applicationStatusTone } from "../status";

export const metadata: Metadata = { title: "Application — NGC ERP" };

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

export default async function ApplicationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [application, currentUser] = await Promise.all([
    applications.getApplication(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!application) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const { personal, church, education, professional, choirHistory, musical } = application.formData;

  let departmentOptions: { value: string; label: string }[] = [];
  let familyOptions: { value: string; label: string }[] = [];
  if (canManage && application.status === "approved") {
    const [departmentRows, familyRows] = await Promise.all([
      departments.listDepartments(supabase),
      families.listFamilies(supabase),
    ]);
    departmentOptions = departmentRows.map((d) => ({ value: d.id, label: d.name }));
    familyOptions = familyRows.map((f) => ({ value: f.id, label: f.name }));
  }

  const boundAdvanceToPendingReview = advanceApplicationStatusAction.bind(null, application.id, "pending_review");
  const boundAdvanceToUnderVerification = advanceApplicationStatusAction.bind(null, application.id, "under_verification");
  const boundAdvanceToPendingApproval = advanceApplicationStatusAction.bind(null, application.id, "pending_approval");
  const boundMarkIncomplete = markApplicationIncompleteAction.bind(null, application.id);
  const boundApprove = decideApplicationAction.bind(null, application.id, "approved");
  const boundReject = decideApplicationAction.bind(null, application.id, "rejected");
  const boundConvert = convertApplicationToMemberAction.bind(null, application.id);

  return (
    <>
      <PageHeader
        title={application.applicantName}
        breadcrumb={["NGC ERP", "Applications", application.applicationNumber]}
        action={<StatusPill tone={applicationStatusTone(application.status)} label={applicationStatusLabel(application.status)} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Application number", application.applicationNumber],
                ["Completion", `${application.completionPercentage}%`],
                ["Verification contact", application.verificationContact],
                ["Submitted", application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Not yet submitted"],
                ["Reviewed by", application.reviewedBy ?? "—"],
                ["Decision reason", application.decisionReason ?? "—"],
              ]}
            />
            {application.missingFields.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {application.status === "incomplete" ? "Notes sent to the applicant" : "Still missing before submission"}
                </p>
                <ul className="ml-4 list-disc text-sm text-ink-primary">
                  {application.missingFields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["First name", personal.firstName ?? ""],
                ["Middle name", personal.middleName ?? ""],
                ["Last name", personal.lastName ?? ""],
                ["Preferred name", personal.preferredName ?? ""],
                ["Gender", personal.gender ?? ""],
                ["Date of birth", personal.dateOfBirth ?? ""],
                ["Nationality", personal.nationality ?? ""],
                ["National ID number", personal.nationalIdNumber ?? ""],
                ["Email", personal.email ?? ""],
                ["Phone", personal.phone ?? ""],
                ["WhatsApp number", personal.whatsappNumber ?? ""],
                ["Region", personal.region ?? ""],
                ["District", personal.district ?? ""],
                ["Emergency contact name", personal.emergencyContactName ?? ""],
                ["Emergency contact phone", personal.emergencyContactPhone ?? ""],
              ]}
            />
            {personal.physicalAddress && (
              <p className="mt-3 text-sm text-ink-primary">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Physical address: </span>
                {personal.physicalAddress}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Church background</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Current church", church.currentChurch ?? ""],
                ["Church location", church.churchLocation ?? ""],
                ["Pastor's name", church.pastorName ?? ""],
              ]}
            />
            {(church.churchMembershipInfo || church.referralInfo) && (
              <div className="mt-3 flex flex-col gap-2 text-sm text-ink-primary">
                {church.churchMembershipInfo && <p>{church.churchMembershipInfo}</p>}
                {church.referralInfo && <p>{church.referralInfo}</p>}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education, profession &amp; choir history</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Profession", professional.profession ?? ""],
                ["Employer", professional.employer ?? ""],
                ["Previously a choir member", choirHistory.previouslyChoirMember ? "Yes" : "No"],
                ["Previous choir", choirHistory.previousChoirName ?? ""],
                ["Duration", choirHistory.previousChoirDuration ?? ""],
              ]}
            />
            {(education.entries?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Education</p>
                <ul className="ml-4 list-disc text-sm text-ink-primary">
                  {education.entries?.map((e, i) => (
                    <li key={i}>
                      {[e.qualification, e.institution, e.year].filter(Boolean).join(" — ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Musical information</CardTitle>
            </CardHeader>
            <FieldGrid
              fields={[
                ["Vocal category", musical.vocalCategory ?? ""],
                ["Instrument", musical.instrument ?? ""],
              ]}
            />
            {(musical.musicTraining || musical.previousPerformanceExperience) && (
              <div className="mt-3 flex flex-col gap-2 text-sm text-ink-primary">
                {musical.musicTraining && <p>{musical.musicTraining}</p>}
                {musical.previousPerformanceExperience && <p>{musical.previousPerformanceExperience}</p>}
              </div>
            )}
          </Card>
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            {application.status === "submitted" && (
              <Card>
                <CardHeader>
                  <CardTitle>Begin review</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundAdvanceToPendingReview} label="Move to pending review" pendingLabel="Moving…" />
              </Card>
            )}
            {application.status === "pending_review" && (
              <Card>
                <CardHeader>
                  <CardTitle>Verify details</CardTitle>
                </CardHeader>
                <SimpleActionForm
                  action={boundAdvanceToUnderVerification}
                  label="Move to under verification"
                  pendingLabel="Moving…"
                />
              </Card>
            )}
            {application.status === "under_verification" && (
              <Card>
                <CardHeader>
                  <CardTitle>Ready for a decision</CardTitle>
                </CardHeader>
                <SimpleActionForm action={boundAdvanceToPendingApproval} label="Move to pending approval" pendingLabel="Moving…" />
              </Card>
            )}

            {(application.status === "submitted" ||
              application.status === "pending_review" ||
              application.status === "under_verification" ||
              application.status === "pending_approval") && (
              <Card>
                <CardHeader>
                  <CardTitle>Request more information</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">
                  One note per line — the applicant will see these when they check their status and can resubmit.
                </p>
                <ReasonActionForm
                  action={boundMarkIncomplete}
                  fieldName="notes"
                  fieldLabel="What needs to change?"
                  required
                  label="Send back as incomplete"
                  pendingLabel="Sending…"
                  variant="secondary"
                />
              </Card>
            )}

            {application.status === "pending_approval" && (
              <Card>
                <CardHeader>
                  <CardTitle>Decision</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">
                  The reason you give here is what the applicant will see in their decision letter (a later phase adds
                  PDF generation — for now this is stored as the record of the decision).
                </p>
                <div className="flex flex-col gap-4">
                  <ReasonActionForm
                    action={boundApprove}
                    fieldName="reason"
                    fieldLabel="Reason for approval"
                    required
                    label="Approve"
                    pendingLabel="Approving…"
                  />
                  <ReasonActionForm
                    action={boundReject}
                    fieldName="reason"
                    fieldLabel="Reason for rejection"
                    required
                    label="Reject"
                    pendingLabel="Rejecting…"
                    variant="destructive"
                  />
                </div>
              </Card>
            )}

            {application.status === "approved" && (
              <Card>
                <CardHeader>
                  <CardTitle>Convert to member</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">
                  Issues a Member ID, starts a 90-day (configurable) probation period, and — if selected — records the
                  initial department/family placement.
                </p>
                <ConvertForm action={boundConvert} departmentOptions={departmentOptions} familyOptions={familyOptions} />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
