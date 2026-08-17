export type ProbationStatus = "active" | "completed" | "failed" | "extended";

export interface ProbationSummary {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  applicationId: string | null;
  startedAt: string;
  durationDays: number;
  deadline: string;
  assignedDepartmentId: string | null;
  assignedFamilyId: string | null;
  responsibleLeaderId: string | null;
  status: ProbationStatus;
  outcomeNotes: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}
