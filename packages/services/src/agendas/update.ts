import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAgendaRow } from "./map";
import type { Agenda, AgendaStatus, UpdateAgendaInput } from "./types";

/** `agendas_write_management` RLS (0017) already gates every write on `management.agenda.manage` — no application-layer permission check is duplicated here, the same "trust Postgres" pattern used everywhere else in this codebase. */
export async function updateAgenda(client: SupabaseClient<Database>, id: string, input: UpdateAgendaInput): Promise<Agenda> {
  const patch: Database["public"]["Tables"]["agendas"]["Update"] = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new ServiceError("A title is required.");
    patch.title = title;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.votingMethod !== undefined) patch.voting_method = input.votingMethod;
  if (input.eligibleVoterScope !== undefined) patch.eligible_voter_scope = input.eligibleVoterScope;
  if (input.eligibleDepartmentId !== undefined) patch.eligible_department_id = input.eligibleDepartmentId;
  if (input.eligibleFamilyId !== undefined) patch.eligible_family_id = input.eligibleFamilyId;
  if (input.eligibleUserIds !== undefined) patch.eligible_user_ids = input.eligibleUserIds;
  if (input.isAnonymous !== undefined) patch.is_anonymous = input.isAnonymous;
  if (input.votingDeadline !== undefined) {
    if (!input.votingDeadline) throw new ServiceError("A voting deadline is required.");
    patch.voting_deadline = input.votingDeadline;
  }
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await client.from("agendas").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the agenda item.", error);
  return mapAgendaRow(data);
}

export async function setAgendaStatus(client: SupabaseClient<Database>, id: string, status: AgendaStatus): Promise<Agenda> {
  return updateAgenda(client, id, { status });
}
