export interface MemberSummary {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  photoUrl: string | null;
  membershipStatus: string;
  primaryDepartmentId: string | null;
  primaryDepartmentName: string | null;
  familyId: string | null;
  familyName: string | null;
  joinedAt: string | null;
}

export interface MemberDetail extends MemberSummary {
  userId: string | null;
  applicationId: string | null;
  middleName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  nationalIdNumber: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  physicalAddress: string | null;
  region: string | null;
  district: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  exitedAt: string | null;
  exitReason: string | null;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListMembersOptions {
  membershipStatus?: string;
  departmentId?: string;
  familyId?: string;
  /** Matched against first/last name (case-insensitive substring). */
  search?: string;
  /** Inclusive `joined_at` range — added for the Phase 13 Reporting Engine's Member Report ("new members this period"), mirrors `attendance.ListSessionsOptions`'s own `from`/`to` shape. A member with a null `joined_at` is never matched by either bound, same as `contributions.ListCampaignsOptions`'s null-`deadline` handling. */
  joinedFrom?: string;
  joinedTo?: string;
}

/**
 * Fields a member may correct on their OWN record. Deliberately mirrors the
 * self-editable side of the allowlist enforced by the database trigger
 * `enforce_members_self_update_column_guard` (supabase/migrations/0023) —
 * this type existing at all is what makes it a compile error, not just a
 * runtime RLS/trigger rejection, to build a self-service edit form that
 * tries to send a restricted field. See updateMemberContactInfo.
 */
export interface MemberContactInfoInput {
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  photoUrl?: string | null;
  gender?: string | null;
  nationality?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  physicalAddress?: string | null;
  region?: string | null;
  district?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

/**
 * HR-only full-record update. Deliberately EXCLUDES primary_department_id
 * and family_id — those change only through assignPrimaryDepartment()/
 * assignFamily() (see assign-department.ts/assign-family.ts), which also
 * write the member_departments/member_families history log so the
 * denormalized "current" pointer on `members` can never silently drift
 * from that history.
 */
export interface MemberRecordInput extends MemberContactInfoInput {
  middleName?: string | null;
  dateOfBirth?: string | null;
  nationalIdNumber?: string | null;
  membershipStatus?: "probation" | "active" | "suspended" | "potentially_inactive" | "inactive" | "exited";
  joinedAt?: string | null;
  exitedAt?: string | null;
  exitReason?: string | null;
}

export interface CreateMemberInput {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  preferredName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  nationalIdNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  physicalAddress?: string | null;
  region?: string | null;
  district?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  primaryDepartmentId?: string | null;
  familyId?: string | null;
  joinedAt?: string | null;
  userId?: string | null;
  applicationId?: string | null;
}
