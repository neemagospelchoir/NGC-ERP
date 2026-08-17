import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapVoteRow } from "./map";
import type { CastVoteInput, VoteRecord } from "./types";

const RLS_VIOLATION = "42501";
const UNIQUE_VIOLATION = "23505";

/**
 * Casts a vote. Checked-then-written against the table's own `unique
 * (agenda_id, voter_id)` constraint (0017), consistent with this
 * codebase's existing preference for an explicit pre-check over relying
 * solely on a raw constraint-violation error for the common case (see
 * `attendance.recordAttendance`'s identical "check current, then write"
 * shape) — the DB constraint remains the real backstop against a
 * same-instant double-submit race, which is why the 23505 branch below is
 * still handled, not removed.
 *
 * `votes_insert_self` RLS (0017, tightened by 0034) is the ONLY real
 * authorization boundary on eligibility — it requires `voter_id =
 * auth.uid()` AND that the agenda is `open`, its deadline hasn't passed,
 * and the caller actually matches the agenda's `eligible_voter_scope`.
 * This function does not re-derive or duplicate any of that eligibility
 * logic client-side (a client-side-only check would be theater, not a
 * boundary — see 0034's own doc comment on why the schema author's
 * original "enforce this at the service/API layer" plan for `votes` was
 * not good enough on its own); it only translates the ways that insert can
 * fail into a message a caller can actually act on.
 */
export async function castVote(client: SupabaseClient<Database>, input: CastVoteInput): Promise<VoteRecord> {
  if (!input.voterId) throw new ServiceError("A voter is required.");

  const existing = await getMyVote(client, input.agendaId, input.voterId);
  if (existing) throw new ServiceError("You have already voted on this agenda item.");

  const { data, error } = await client
    .from("votes")
    .insert({ agenda_id: input.agendaId, voter_id: input.voterId, choice: input.choice })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new ServiceError("You have already voted on this agenda item.", error);
    if (error.code === RLS_VIOLATION) {
      throw new ServiceError("You are not eligible to vote on this agenda item, or voting is no longer open.", error);
    }
    throw new ServiceError("Could not record your vote.", error);
  }
  return mapVoteRow(data);
}

/** `votes_select_own_or_admin` RLS always lets a caller read their own row — used to render "you voted: yes" / show the ballot form only if not yet voted. */
export async function getMyVote(client: SupabaseClient<Database>, agendaId: string, voterId: string): Promise<VoteRecord | null> {
  const { data, error } = await client.from("votes").select("*").eq("agenda_id", agendaId).eq("voter_id", voterId).maybeSingle();
  if (error) throw new ServiceError("Could not check your vote.", error);
  return data ? mapVoteRow(data) : null;
}

/**
 * Individual ballots. `votes_select_own_or_admin` RLS (tightened by 0034)
 * naturally scopes this per caller with no extra application-layer
 * filtering needed: a plain member gets back only their own row (if any),
 * a `management.agenda.manage` holder gets every row ONLY when the agenda
 * is not anonymous, and a true `super_admin` always gets every row. The UI
 * additionally only offers this view when `!agenda.isAnonymous` so a
 * manager is never shown a call that would silently return nothing for an
 * anonymous agenda and read as a bug rather than a deliberate protection.
 */
export async function listVotesForAgenda(client: SupabaseClient<Database>, agendaId: string): Promise<VoteRecord[]> {
  const { data, error } = await client.from("votes").select("*").eq("agenda_id", agendaId).order("cast_at", { ascending: true });
  if (error) throw new ServiceError("Could not load ballots for this agenda item.", error);
  return (data ?? []).map(mapVoteRow);
}
