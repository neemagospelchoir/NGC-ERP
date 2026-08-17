import type { Database } from "@ngc/db";
import type { MemberDetail, MemberSummary } from "./types";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export function mapMemberSummary(
  row: MemberRow,
  names: { departmentNamesById: Map<string, string>; familyNamesById: Map<string, string> }
): MemberSummary {
  return {
    id: row.id,
    memberNumber: row.member_number,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name,
    photoUrl: row.photo_url,
    membershipStatus: row.membership_status,
    primaryDepartmentId: row.primary_department_id,
    primaryDepartmentName: row.primary_department_id
      ? names.departmentNamesById.get(row.primary_department_id) ?? null
      : null,
    familyId: row.family_id,
    familyName: row.family_id ? names.familyNamesById.get(row.family_id) ?? null : null,
    joinedAt: row.joined_at,
  };
}

export function mapMemberDetail(
  row: MemberRow,
  names: { departmentNamesById: Map<string, string>; familyNamesById: Map<string, string> }
): MemberDetail {
  return {
    ...mapMemberSummary(row, names),
    userId: row.user_id,
    applicationId: row.application_id,
    middleName: row.middle_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    nationalIdNumber: row.national_id_number,
    email: row.email,
    phone: row.phone,
    whatsappNumber: row.whatsapp_number,
    physicalAddress: row.physical_address,
    region: row.region,
    district: row.district,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    exitedAt: row.exited_at,
    exitReason: row.exit_reason,
    qrToken: row.qr_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
