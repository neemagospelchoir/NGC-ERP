import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMemberDetail } from "./map";
import { resolveDepartmentAndFamilyNames } from "./resolve-names";
import type { MemberContactInfoInput, MemberDetail } from "./types";

/**
 * The self-service "edit my profile" path. `MemberContactInfoInput`'s shape
 * is the actual enforcement mechanism here — it simply has no field for
 * member_number/membership_status/department/family/etc., so this function
 * cannot be called with them regardless of what a caller intends. The
 * database trigger `enforce_members_self_update_column_guard` (0023) is
 * still the real, non-bypassable gate; this is the applicationlayer
 * mirror of it, same defense-in-depth pattern as Phase 6's authorize().
 */
export async function updateMemberContactInfo(
  client: SupabaseClient<Database>,
  memberId: string,
  input: MemberContactInfoInput
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
  if (input.preferredName !== undefined) patch.preferred_name = input.preferredName;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.nationality !== undefined) patch.nationality = input.nationality;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.whatsappNumber !== undefined) patch.whatsapp_number = input.whatsappNumber;
  if (input.physicalAddress !== undefined) patch.physical_address = input.physicalAddress;
  if (input.region !== undefined) patch.region = input.region;
  if (input.district !== undefined) patch.district = input.district;
  if (input.emergencyContactName !== undefined) patch.emergency_contact_name = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) patch.emergency_contact_phone = input.emergencyContactPhone;

  const { data, error } = await client.from("members").update(patch).eq("id", memberId).select("*").single();

  if (error) {
    throw new ServiceError("Could not update your profile. If you're trying to change your status, department, or family, contact an administrator.", error);
  }

  const names = await resolveDepartmentAndFamilyNames(client, [data]);
  return mapMemberDetail(data, names);
}
