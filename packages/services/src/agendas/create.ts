import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAgendaRow } from "./map";
import type { Agenda, CreateAgendaInput } from "./types";

/**
 * Creates an agenda item (PRD S45) — gated on `management.agenda.manage`
 * by `agendas_write_management` RLS (0017), held by Secretary, Chairman,
 * Vice Chairman, and Super Admin per the seed. Validates that a scoped
 * `eligibleVoterScope` carries the field it needs to actually mean
 * something — the same shape `sendNotification` (10.2) already enforces
 * for `department`/`family`/`specific_users` audiences, and for the same
 * reason: an agenda scoped to `department` with no `eligibleDepartmentId`
 * would satisfy no branch of 0034's own `votes_insert_self` eligibility
 * check, silently locking out every voter.
 */
export async function createAgenda(client: SupabaseClient<Database>, input: CreateAgendaInput): Promise<Agenda> {
  const title = input.title.trim();
  if (!title) throw new ServiceError("A title is required.");
  if (!input.votingDeadline) throw new ServiceError("A voting deadline is required.");
  if (!input.createdBy) throw new ServiceError("A creator is required.");

  const scope = input.eligibleVoterScope ?? "all_members";
  if (scope === "department" && !input.eligibleDepartmentId) throw new ServiceError("A department is required for this voter scope.");
  if (scope === "family" && !input.eligibleFamilyId) throw new ServiceError("A family is required for this voter scope.");
  const userIds = scope === "specific_users" ? Array.from(new Set((input.eligibleUserIds ?? []).map((id) => id.trim()).filter(Boolean))) : [];
  if (scope === "specific_users" && userIds.length === 0) throw new ServiceError("At least one user ID is required for this voter scope.");

  const { data, error } = await client
    .from("agendas")
    .insert({
      title,
      description: input.description?.trim() || null,
      voting_method: input.votingMethod ?? "yes_no_abstain",
      eligible_voter_scope: scope,
      eligible_department_id: scope === "department" ? input.eligibleDepartmentId : null,
      eligible_family_id: scope === "family" ? input.eligibleFamilyId : null,
      eligible_user_ids: userIds,
      is_anonymous: input.isAnonymous ?? false,
      voting_deadline: input.votingDeadline,
      status: input.status ?? "open",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the agenda item.", error);
  return mapAgendaRow(data);
}
