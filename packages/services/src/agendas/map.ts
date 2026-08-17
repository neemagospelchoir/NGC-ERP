import type { Database } from "@ngc/db";
import type { Agenda, AgendaResults, AgendaStatus, EligibleVoterScope, VoteChoice, VoteRecord, VotingMethod } from "./types";

type AgendaRow = Database["public"]["Tables"]["agendas"]["Row"];
type VoteRow = Database["public"]["Tables"]["votes"]["Row"];
type AgendaResultsRow = Database["public"]["Views"]["agenda_results"]["Row"];

export function mapAgendaRow(row: AgendaRow): Agenda {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    votingMethod: row.voting_method as VotingMethod,
    eligibleVoterScope: row.eligible_voter_scope as EligibleVoterScope,
    eligibleDepartmentId: row.eligible_department_id,
    eligibleFamilyId: row.eligible_family_id,
    eligibleUserIds: row.eligible_user_ids ?? [],
    isAnonymous: row.is_anonymous,
    votingDeadline: row.voting_deadline,
    status: row.status as AgendaStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVoteRow(row: VoteRow): VoteRecord {
  return {
    id: row.id,
    agendaId: row.agenda_id,
    voterId: row.voter_id,
    choice: row.choice as VoteChoice,
    castAt: row.cast_at,
  };
}

/**
 * `agenda_results` (0017) marks every aggregate column nullable at the type
 * level (the generated `Database` type can't express "always populated for
 * a row that exists at all" for a `group by`-computed view), the same
 * defensive shape `mapMemberAttendanceSummary` already uses for the
 * equivalent `member_attendance_summary` view.
 */
export function mapAgendaResultsRow(row: AgendaResultsRow): AgendaResults {
  return {
    agendaId: row.agenda_id ?? "",
    yesCount: row.yes_count ?? 0,
    noCount: row.no_count ?? 0,
    abstainCount: row.abstain_count ?? 0,
    totalVotes: row.total_votes ?? 0,
  };
}
