import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMemberDetail } from "./map";
import { resolveDepartmentAndFamilyNames } from "./resolve-names";
import type { CreateMemberInput, MemberDetail } from "./types";

const MEMBER_NUMBER_SEQUENCE_KEY = "member_number";
const MEMBER_NUMBER_SETTING_KEY = "id_format.member_number";
/** Only used if system_settings is somehow missing the row every seed applies — never the organization's real format, just a way to fail into something usable instead of throwing. */
const FALLBACK_MEMBER_NUMBER_FORMAT = "MEMBER-{year}-{sequence}";

/**
 * Creates a member directly (the HR "add a member manually" path — the
 * primary path in later phases is Onboarding's application-approval flow,
 * which will call this same function internally once Phase 7.2 exists).
 * Never hardcodes the Member ID format (spec: no organization-specific rule
 * hardcoded) — reads `system_settings.id_format.member_number` and passes it
 * to the same `next_formatted_id()` Postgres function every other
 * formatted-ID sequence in this schema uses (spec S52/ARCHITECTURE §6).
 *
 * membership_status is intentionally NOT accepted here — every direct
 * creation starts in `probation`, matching the column default and the
 * membership lifecycle spec describes (probation → active is a deliberate
 * transition, not a creation-time choice).
 */
export async function createMember(client: SupabaseClient<Database>, input: CreateMemberInput): Promise<MemberDetail> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw new ServiceError("First name and last name are required.");
  }

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", MEMBER_NUMBER_SETTING_KEY)
    .maybeSingle();

  if (formatError) {
    throw new ServiceError("Could not resolve the Member ID format.", formatError);
  }
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_MEMBER_NUMBER_FORMAT;

  const { data: memberNumber, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: MEMBER_NUMBER_SEQUENCE_KEY,
    p_format: format,
  });

  if (rpcError || !memberNumber) {
    throw new ServiceError("Could not generate a Member ID.", rpcError);
  }

  const { data, error } = await client
    .from("members")
    .insert({
      member_number: memberNumber,
      user_id: input.userId ?? null,
      application_id: input.applicationId ?? null,
      first_name: firstName,
      middle_name: input.middleName ?? null,
      last_name: lastName,
      preferred_name: input.preferredName ?? null,
      gender: input.gender ?? null,
      date_of_birth: input.dateOfBirth ?? null,
      nationality: input.nationality ?? null,
      national_id_number: input.nationalIdNumber ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp_number: input.whatsappNumber ?? null,
      physical_address: input.physicalAddress ?? null,
      region: input.region ?? null,
      district: input.district ?? null,
      emergency_contact_name: input.emergencyContactName ?? null,
      emergency_contact_phone: input.emergencyContactPhone ?? null,
      primary_department_id: input.primaryDepartmentId ?? null,
      family_id: input.familyId ?? null,
      joined_at: input.joinedAt ?? null,
      // Explicit, not relied-upon-as-a-DB-default: every direct creation
      // starts in probation (see doc comment above) — stating it here
      // keeps that intent visible in code, not just in a column default a
      // reader would have to go check the schema to find.
      membership_status: "probation",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError("A member with a conflicting unique field (Member ID or linked account) already exists.", error);
    }
    throw new ServiceError("Could not create the member.", error);
  }

  const names = await resolveDepartmentAndFamilyNames(client, [data]);
  return mapMemberDetail(data, names);
}
