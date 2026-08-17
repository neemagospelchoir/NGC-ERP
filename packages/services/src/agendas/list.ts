import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAgendaRow, mapAgendaResultsRow } from "./map";
import type { Agenda, AgendaResults } from "./types";

/** `agendas_select_authenticated` RLS (0017) lets any signed-in user read every agenda row — only the individual `votes` rows behind it are access-controlled (0034). */
export async function listAgendas(client: SupabaseClient<Database>): Promise<Agenda[]> {
  const { data, error } = await client.from("agendas").select("*").order("voting_deadline", { ascending: false });
  if (error) throw new ServiceError("Could not load agenda items.", error);
  return (data ?? []).map(mapAgendaRow);
}

export async function getAgenda(client: SupabaseClient<Database>, id: string): Promise<Agenda | null> {
  const { data, error } = await client.from("agendas").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the agenda item.", error);
  return data ? mapAgendaRow(data) : null;
}

/**
 * `agenda_results` (0017) is aggregate-only (yes/no/abstain/total counts,
 * never a voter_id) so it is safe to show to any signed-in caller
 * regardless of the agenda's own `is_anonymous` flag — the tally is the
 * part "anonymous" was never meant to hide, only who voted which way.
 */
export async function getAgendaResults(client: SupabaseClient<Database>, agendaId: string): Promise<AgendaResults | null> {
  const { data, error } = await client.from("agenda_results").select("*").eq("agenda_id", agendaId).maybeSingle();
  if (error) throw new ServiceError("Could not load the agenda's vote tally.", error);
  return data ? mapAgendaResultsRow(data) : null;
}
