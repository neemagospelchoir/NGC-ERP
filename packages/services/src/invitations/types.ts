export type InvitationStatus =
  | "draft"
  | "submitted"
  | "received"
  | "under_review"
  | "pending_information"
  | "pending_management_approval"
  | "approved"
  | "declined"
  | "cancelled"
  | "completed"
  | "postponed";

export interface InvitationFormData {
  organizerName: string;
  organizerContactEmail?: string | null;
  organizerContactPhone?: string | null;
  organizationName?: string | null;
  eventName: string;
  eventType?: string | null;
  proposedDate: string;
  proposedTime?: string | null;
  venue?: string | null;
  location?: string | null;
  region?: string | null;
  expectedAudience?: number | null;
  natureOfInvitation?: string | null;
  performanceRequirements?: string | null;
  technicalRequirements?: string | null;
  transportRequirements?: string | null;
  accommodationRequirements?: string | null;
  financialInformation?: string | null;
  additionalNotes?: string | null;
}

export interface InvitationSummary extends InvitationFormData {
  id: string;
  invitationNumber: string;
  status: InvitationStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvitationDetail = InvitationSummary;

/** The organizer-safe projection returned by organizer-access.ts — status pipeline and the fields THEY submitted, never the internal `access_token_hash`. */
export type OrganizerView = InvitationSummary;

export interface OrganizerCredentials {
  invitationNumber: string;
  accessToken: string;
  verificationContact: string;
}

export interface SubmitInvitationInput extends InvitationFormData {
  /** The organizer's chosen status-check channel (email or phone) — required alongside the invitation number + access token on every later status check (mirrors applications' token model, ARCHITECTURE.md §5.1). */
  verificationContact: string;
}

export interface SubmitInvitationResult {
  invitationId: string;
  invitationNumber: string;
  /** Shown to the organizer EXACTLY ONCE — only its hash persists (see token.ts). */
  accessToken: string;
}
