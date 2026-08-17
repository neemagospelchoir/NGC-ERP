import type { Database } from "@ngc/db";
import type { ProbationStatus, ProbationSummary } from "./types";

type ProbationRow = Database["public"]["Tables"]["probation"]["Row"];

export function mapProbationSummary(
  row: ProbationRow,
  memberNamesById: Map<string, { name: string; memberNumber: string }>
): ProbationSummary {
  const memberInfo = memberNamesById.get(row.member_id);
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: memberInfo?.name ?? "(unknown member)",
    memberNumber: memberInfo?.memberNumber ?? "—",
    applicationId: row.application_id,
    startedAt: row.started_at,
    durationDays: row.duration_days,
    deadline: row.deadline,
    assignedDepartmentId: row.assigned_department_id,
    assignedFamilyId: row.assigned_family_id,
    responsibleLeaderId: row.responsible_leader_id,
    status: row.status as ProbationStatus,
    outcomeNotes: row.outcome_notes,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  };
}
