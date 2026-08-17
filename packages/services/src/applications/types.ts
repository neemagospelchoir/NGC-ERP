/**
 * Mirrors PRD.md §9.1's form sections (personal, church, education,
 * professional, choir_history, musical) exactly, and lines up with
 * `member_profiles`' own column groups (0004_members.sql) so an approved
 * application's data maps cleanly onto the strongly-typed member tables at
 * conversion time (see convert.ts). Stored as one JSONB blob
 * (`applications.submitted_data`) rather than columns, per 0005's own
 * comment: the form is long/evolves, and only approved applications get
 * promoted into the typed tables.
 *
 * Document uploads (passport photo, national ID scan, certificates, etc.)
 * are part of the PRD form but are out of scope for this phase — no
 * Supabase Storage integration exists yet in this codebase. Deferred, not
 * silently dropped: see docs/PHASE_7_2.md.
 */
export interface ApplicationPersonalData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  nationalIdNumber?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  physicalAddress?: string;
  region?: string;
  district?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface ApplicationChurchData {
  currentChurch?: string;
  churchLocation?: string;
  pastorName?: string;
  churchMembershipInfo?: string;
  referralInfo?: string;
}

export interface ApplicationEducationEntry {
  qualification?: string;
  institution?: string;
  year?: string;
}

export interface ApplicationEducationData {
  entries?: ApplicationEducationEntry[];
}

export interface ApplicationProfessionalData {
  profession?: string;
  employer?: string;
  professionalQualifications?: string[];
  skills?: string[];
}

export interface ApplicationChoirHistoryData {
  previouslyChoirMember?: boolean;
  previousChoirName?: string;
  previousChoirDuration?: string;
  previousChoirResponsibilities?: string;
  previousChoirLeaveReason?: string;
  musicalExperience?: string;
}

export interface ApplicationMusicalData {
  vocalCategory?: string;
  instrument?: string;
  musicalSkills?: string[];
  musicTraining?: string;
  previousPerformanceExperience?: string;
}

export interface ApplicationFormData {
  personal: ApplicationPersonalData;
  church: ApplicationChurchData;
  education: ApplicationEducationData;
  professional: ApplicationProfessionalData;
  choirHistory: ApplicationChoirHistoryData;
  musical: ApplicationMusicalData;
}

export const EMPTY_APPLICATION_FORM_DATA: ApplicationFormData = {
  personal: {},
  church: {},
  education: {},
  professional: {},
  choirHistory: {},
  musical: {},
};

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "incomplete"
  | "pending_review"
  | "under_verification"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "probation"
  | "probation_completed"
  | "probation_failed"
  | "converted_to_member";

export interface ApplicationSummary {
  id: string;
  applicationNumber: string;
  applicationType: string;
  status: ApplicationStatus;
  completionPercentage: number;
  missingFields: string[];
  submittedAt: string | null;
  createdAt: string;
  /** Convenience projection of submittedData.personal — the fields HR actually scans a list for. */
  applicantName: string;
  verificationContact: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  formData: ApplicationFormData;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  updatedAt: string;
}

/** What the public-facing pages ever see — never access_token_hash, never anything not needed to render the applicant's own form/status. */
export interface ApplicantView {
  applicationNumber: string;
  applicationType: string;
  status: ApplicationStatus;
  completionPercentage: number;
  missingFields: string[];
  formData: ApplicationFormData;
  submittedAt: string | null;
}
