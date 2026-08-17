import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import * as members from "../members";
import { mapApplicationDetail, normalizeFormData } from "./map";
import type { ApplicationDetail } from "./types";

const PROBATION_DURATION_SETTING_KEY = "probation.default_duration_days";
const FALLBACK_PROBATION_DURATION_DAYS = 90;

export interface ConvertApplicationToMemberInput {
  /** The signed-in HR user performing the conversion — recorded as probation.decided_by is NOT set here (decided_by is for completing/failing probation later; see ../probation) but IS used as member_departments/member_families.changed_by for the initial assignment, and as probation.responsible_leader_id's default if none is given explicitly. */
  reviewerId: string;
  primaryDepartmentId?: string | null;
  familyId?: string | null;
  responsibleLeaderId?: string | null;
}

export interface ConvertApplicationToMemberResult {
  member: members.MemberDetail;
  probationId: string;
  application: ApplicationDetail;
}

/**
 * The "Approved → Member ID issued → Probation created → Department/Family
 * assigned" leg of PRD §9.1's pipeline, as one function so the three
 * writes it performs are at least grouped and documented together (they
 * are still sequential PostgREST calls, not one transaction — same
 * documented, not-silently-assumed-away limitation as
 * members/assign-department.ts).
 *
 * Deliberately does NOT pass primaryDepartmentId/familyId into
 * members.createMember()'s insert, even though that function's
 * CreateMemberInput accepts them directly — createMember() sets those
 * columns with a raw insert and does not write a member_departments/
 * member_families history row for them (a pre-existing gap from Phase 7.1,
 * noted in docs/PHASE_7_2.md rather than fixed here, since patching
 * createMember()'s public shape now would touch and re-open already-
 * shipped, already-tested Phase 7.1 code for a module this phase didn't
 * set out to modify). Instead, this function creates the member with no
 * department/family, then calls assignDepartment()/assignFamily()
 * immediately after — the same functions any LATER reassignment would use
 * — so the application's initial placement is captured in the history log
 * from day one, not silently exempt from it.
 *
 * Only ever call this when `application.status === 'approved'` and
 * `application.applicationType === 'new_member'` — enforced below, not
 * just assumed by the caller. Runs on the caller's own RLS-scoped client
 * (not the service-role client): the signed-in HR user's own session
 * already satisfies every RLS policy this touches
 * (`members_write_hr`/`member_departments_write_hr`/
 * `member_families_write_hr`/`probation_write_hr`/`applications_write_hr`,
 * all gated on `members.applications.manage`/`members.profiles.manage`),
 * so there is no need to bypass RLS here — unlike the applicant-facing
 * functions in create-draft.ts/applicant-access.ts, which have no
 * authenticated session to rely on at all.
 */
export async function convertApplicationToMember(
  client: SupabaseClient<Database>,
  applicationId: string,
  input: ConvertApplicationToMemberInput
): Promise<ConvertApplicationToMemberResult> {
  const { data: appRow, error: appError } = await client
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) throw new ServiceError("Could not load the application.", appError);
  if (!appRow) throw new ServiceError("Application not found.");
  if (appRow.application_type !== "new_member") {
    throw new ServiceError("Only new-member applications can be converted here.");
  }
  if (appRow.status !== "approved") {
    throw new ServiceError(`This application must be "approved" before it can be converted (currently "${appRow.status}").`);
  }

  const formData = normalizeFormData(appRow.submitted_data);
  const { firstName, lastName } = formData.personal;
  if (!firstName?.trim() || !lastName?.trim()) {
    throw new ServiceError("The application is missing a first or last name and cannot be converted yet.");
  }

  const createdMember = await members.createMember(client, {
    firstName,
    lastName,
    middleName: formData.personal.middleName ?? null,
    preferredName: formData.personal.preferredName ?? null,
    gender: formData.personal.gender ?? null,
    dateOfBirth: formData.personal.dateOfBirth ?? null,
    nationality: formData.personal.nationality ?? null,
    nationalIdNumber: formData.personal.nationalIdNumber ?? null,
    email: formData.personal.email ?? null,
    phone: formData.personal.phone ?? null,
    whatsappNumber: formData.personal.whatsappNumber ?? null,
    physicalAddress: formData.personal.physicalAddress ?? null,
    region: formData.personal.region ?? null,
    district: formData.personal.district ?? null,
    emergencyContactName: formData.personal.emergencyContactName ?? null,
    emergencyContactPhone: formData.personal.emergencyContactPhone ?? null,
    applicationId,
    joinedAt: new Date().toISOString().slice(0, 10),
  });

  if (input.primaryDepartmentId) {
    await members.assignDepartment(client, {
      memberId: createdMember.id,
      departmentId: input.primaryDepartmentId,
      assignmentType: "primary",
      changedBy: input.reviewerId,
      notes: "Initial placement on conversion from application.",
    });
  }
  if (input.familyId) {
    await members.assignFamily(client, {
      memberId: createdMember.id,
      familyId: input.familyId,
      changedBy: input.reviewerId,
      notes: "Initial placement on conversion from application.",
    });
  }

  const { data: durationSetting, error: durationError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", PROBATION_DURATION_SETTING_KEY)
    .maybeSingle();
  if (durationError) throw new ServiceError("Could not resolve the probation duration.", durationError);
  const durationDays =
    typeof durationSetting?.value === "number" ? durationSetting.value : FALLBACK_PROBATION_DURATION_DAYS;

  const startedAt = new Date();
  const deadline = new Date(startedAt);
  deadline.setDate(deadline.getDate() + durationDays);

  const { data: probationRow, error: probationError } = await client
    .from("probation")
    .insert({
      member_id: createdMember.id,
      application_id: applicationId,
      duration_days: durationDays,
      deadline: deadline.toISOString().slice(0, 10),
      assigned_department_id: input.primaryDepartmentId ?? null,
      assigned_family_id: input.familyId ?? null,
      responsible_leader_id: input.responsibleLeaderId ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (probationError) throw new ServiceError("The member was created, but the probation record could not be created. Please contact support before proceeding.", probationError);

  const { data: updatedAppRow, error: updateAppError } = await client
    .from("applications")
    .update({ status: "probation" })
    .eq("id", applicationId)
    .select("*")
    .single();

  if (updateAppError) {
    throw new ServiceError(
      "The member and probation record were created, but the application status could not be updated. Please contact support.",
      updateAppError
    );
  }

  const finalMember = await members.getMember(client, createdMember.id);
  if (!finalMember) throw new ServiceError("Member was created but could not be re-read.");

  return { member: finalMember, probationId: probationRow.id, application: mapApplicationDetail(updatedAppRow) };
}
