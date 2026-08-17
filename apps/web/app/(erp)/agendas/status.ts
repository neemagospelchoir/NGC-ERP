import type { StatusTone, SelectOption } from "@ngc/ui";
import type { agendas } from "@ngc/services";

const STATUS_LABEL: Record<agendas.AgendaStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<agendas.AgendaStatus, StatusTone> = {
  draft: "neutral",
  open: "good",
  closed: "neutral",
  cancelled: "critical",
};

export function statusLabel(status: agendas.AgendaStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusTone(status: agendas.AgendaStatus): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

/** Mirrors `agendas.setAgendaStatus`'s own allowed transitions (there is no state-machine guard in the service layer itself — `agendas_write_management` RLS is the only gate on a status write — but the UI never offers a transition that wouldn't make sense: forward-only, and no editing a decided vote's own outcome). */
export const NEXT_STATUSES: Record<agendas.AgendaStatus, agendas.AgendaStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

const VOTING_METHOD_LABEL: Record<agendas.VotingMethod, string> = {
  yes_no_abstain: "Yes / No / Abstain",
  yes_no: "Yes / No",
};

export function votingMethodLabel(method: agendas.VotingMethod): string {
  return VOTING_METHOD_LABEL[method] ?? method;
}

export const VOTING_METHOD_OPTIONS: SelectOption[] = Object.entries(VOTING_METHOD_LABEL).map(([value, label]) => ({ value, label }));

/**
 * `leadership` is kept selectable here (unlike Announcements' identical-
 * looking `target_audience` field, see docs/PHASE_10_1.md §2.2) because
 * 0034's own `votes_insert_self` RLS resolves it to a concrete, real check
 * — `has_permission('management.agenda.manage')` — so choosing it actually
 * means something rather than silently admitting everyone or no one.
 */
const ELIGIBLE_VOTER_SCOPE_LABEL: Record<agendas.EligibleVoterScope, string> = {
  all_members: "All members",
  department: "A specific department",
  family: "A specific family",
  leadership: "Leadership (management.agenda.manage holders)",
  specific_users: "Specific members (by user ID)",
};

export function eligibleVoterScopeLabel(scope: agendas.EligibleVoterScope): string {
  return ELIGIBLE_VOTER_SCOPE_LABEL[scope] ?? scope;
}

export const ELIGIBLE_VOTER_SCOPE_OPTIONS: SelectOption[] = Object.entries(ELIGIBLE_VOTER_SCOPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const CHOICE_LABEL: Record<agendas.VoteChoice, string> = {
  yes: "Yes",
  no: "No",
  abstain: "Abstain",
};

export function choiceLabel(choice: agendas.VoteChoice): string {
  return CHOICE_LABEL[choice] ?? choice;
}
