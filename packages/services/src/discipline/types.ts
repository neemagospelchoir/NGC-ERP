export type CaseStatus = "open" | "under_investigation" | "action_decided" | "resolved" | "closed";
export type ActionType = "warning" | "suspension" | "probation_extension" | "dismissal" | "other";

export const ACTION_TYPES: ActionType[] = ["warning", "suspension", "probation_extension", "dismissal", "other"];

export interface DisciplineCategoryOption {
  code: string;
  label: string;
}

export interface CaseSummary {
  id: string;
  caseNumber: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  category: string;
  incidentDate: string;
  description: string;
  officerId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseInput {
  /** Resolved to a member id via findMemberByNumber() before the case is created — see create-case.ts. */
  memberNumber: string;
  category: string;
  incidentDate: string;
  description: string;
  officerId: string;
}

export interface ListCasesOptions {
  status?: CaseStatus;
  memberId?: string;
  /** Inclusive `created_at` range — added for Phase 13.2's (permission-gated) Discipline Report, the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

export interface ActionSummary {
  id: string;
  caseId: string;
  actionType: ActionType;
  decidedBy: string;
  decidedAt: string;
  suspensionStartDate: string | null;
  suspensionEndDate: string | null;
  resolution: string | null;
  restoredBy: string | null;
  restoredAt: string | null;
  restorationReason: string | null;
  createdAt: string;
}

export interface RecordActionInput {
  caseId: string;
  actionType: ActionType;
  decidedBy: string;
  suspensionStartDate?: string | null;
  suspensionEndDate?: string | null;
  resolution?: string | null;
}

export interface RestoreSuspensionInput {
  actionId: string;
  restoredBy: string;
  restorationReason: string;
}
