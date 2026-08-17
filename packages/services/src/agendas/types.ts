export type VotingMethod = "yes_no_abstain" | "yes_no";
export type EligibleVoterScope = "all_members" | "department" | "family" | "leadership" | "specific_users";
export type AgendaStatus = "draft" | "open" | "closed" | "cancelled";
export type VoteChoice = "yes" | "no" | "abstain";

export interface Agenda {
  id: string;
  title: string;
  description: string | null;
  votingMethod: VotingMethod;
  eligibleVoterScope: EligibleVoterScope;
  eligibleDepartmentId: string | null;
  eligibleFamilyId: string | null;
  eligibleUserIds: string[];
  isAnonymous: boolean;
  votingDeadline: string;
  status: AgendaStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgendaInput {
  title: string;
  description?: string | null;
  votingMethod?: VotingMethod;
  eligibleVoterScope?: EligibleVoterScope;
  eligibleDepartmentId?: string | null;
  eligibleFamilyId?: string | null;
  eligibleUserIds?: string[];
  isAnonymous?: boolean;
  votingDeadline: string;
  status?: AgendaStatus;
  /**
   * Resolved server-side from the signed-in caller's own session
   * (`auth.getCurrentUserWithRoles(supabase).id`), never taken from a
   * client-supplied form field — the same "authorship is derived, not
   * trusted" shape as `announcements.createAnnouncement`'s `authorId`.
   */
  createdBy: string;
}

export type UpdateAgendaInput = Partial<Omit<CreateAgendaInput, "createdBy">>;

/** One raw ballot row — only ever returned to a caller `votes_select_own_or_admin` RLS (0017, tightened by 0034) actually permits: the voter themselves, a `management.agenda.manage` holder on a NON-anonymous agenda, or a true `super_admin`. */
export interface VoteRecord {
  id: string;
  agendaId: string;
  voterId: string;
  choice: VoteChoice;
  castAt: string;
}

export interface CastVoteInput {
  agendaId: string;
  /** Resolved server-side, never client-supplied — `votes_insert_self` RLS requires `voter_id = auth.uid()` regardless, but this keeps the service layer's own contract honest about where the value comes from. */
  voterId: string;
  choice: VoteChoice;
}

/** `agenda_results` (0017) — an aggregate-only view; never carries voter_id, so it is safe to show to any signed-in caller regardless of an agenda's anonymity. */
export interface AgendaResults {
  agendaId: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
}
