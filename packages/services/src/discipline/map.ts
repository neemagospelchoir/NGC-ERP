import type { Database } from "@ngc/db";
import type { ActionSummary, CaseStatus, CaseSummary } from "./types";

type CaseRow = Database["public"]["Tables"]["disciplinary_cases"]["Row"];
type ActionRow = Database["public"]["Tables"]["disciplinary_actions"]["Row"];

export function mapCaseSummary(row: CaseRow, memberNamesById: Map<string, { name: string; memberNumber: string }>): CaseSummary {
  const member = memberNamesById.get(row.member_id);
  return {
    id: row.id,
    caseNumber: row.case_number,
    memberId: row.member_id,
    memberName: member?.name ?? "Unknown member",
    memberNumber: member?.memberNumber ?? "",
    category: row.category,
    incidentDate: row.incident_date,
    description: row.description,
    officerId: row.officer_id,
    status: row.status as CaseStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapActionSummary(row: ActionRow): ActionSummary {
  return {
    id: row.id,
    caseId: row.case_id,
    actionType: row.action_type as ActionSummary["actionType"],
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    suspensionStartDate: row.suspension_start_date,
    suspensionEndDate: row.suspension_end_date,
    resolution: row.resolution,
    restoredBy: row.restored_by,
    restoredAt: row.restored_at,
    restorationReason: row.restoration_reason,
    createdAt: row.created_at,
  };
}
