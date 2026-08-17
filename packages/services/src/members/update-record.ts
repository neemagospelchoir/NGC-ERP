import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMemberDetail } from "./map";
import { resolveDepartmentAndFamilyNames } from "./resolve-names";
import type { MemberDetail, MemberRecordInput } from "./types";

/**
 * The HR/admin full-record edit path (gated by RLS's `members_write_hr`/
 * `members_update_self_limited` policies holding `members.profiles.manage`
 * — see 0004). Deliberately does NOT accept primary department/family
 * changes; those go through assignPrimaryDepartment()/assignFamily()
 * instead, which also write the member_departments/member_families history
 * log (see assign-department.ts/assign-family.ts's doc comments).
 */
export async function updateMemberRecord(
  client: SupabaseClient<Database>,
  memberId: string,
  input: MemberRecordInput
): Promise<MemberDetail> {
  const patch: Database["public"]["Tables"]["members"]["Update"] = {};

  if (input.firstName !== undefined) {
    const trimmed = input.firstName.trim();
    if (!trimmed) throw new ServiceError("First name cannot be empty.");
    patch.first_name = trimmed;
  }
  if (input.lastName !== undefined) {
    const trimmed = input.lastName.trim();
    if (!trimmed) throw new ServiceError("Last name cannot be empty.");
    patch.last_name = trimmed;
  }
  if (input.middleName !== undefined) patch.middle_name = input.middleName;
  if (input.preferredName !== undefined) patch.preferred_name = input.preferredName;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
  if (input.nationality !== undefined) patch.nationality = input.nationality;
  if (input.nationalIdNumber !== undefined) patch.national_id_number = input.nationalIdNumber;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.whatsappNumber !== undefined) patch.whatsapp_number = input.whatsappNumber;
  if (input.physicalAddress !== undefined) patch.physical_address = input.physicalAddress;
  if (input.region !== undefined) patch.region = input.region;
  if (input.district !== undefined) patch.district = input.district;
  if (input.emergencyContactName !== undefined) patch.emergency_contact_name = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) patch.emergency_contact_phone = input.emergencyContactPhone;
  if (input.membershipStatus !== undefined) patch.membership_status = input.membershipStatus;
  if (input.joinedAt !== undefined) patch.joined_at = input.joinedAt;
  if (input.exitedAt !== undefined) patch.exited_at = input.exitedAt;
  if (input.exitReason !== undefined) patch.exit_reason = input.exitReason;

  const { data, error } = await client.from("members").update(patch).eq("id", memberId).select("*").single();

  if (error) {
    throw new ServiceError("Could not update the member record.", error);
  }

  const names = await resolveDepartmentAndFamilyNames(client, [data]);
  return mapMemberDetail(data, names);
}
