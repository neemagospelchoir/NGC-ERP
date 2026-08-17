import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapActionSummary, mapCaseSummary } from "./map";
import type { ActionSummary, CaseSummary, ListCasesOptions } from "./types";

/**
 * `disciplinary_cases_select_discipline_only` RLS (0007) already limits
 * results to `discipline.cases.read`/`.manage` holders — no other role,
 * not even the member the case concerns, per spec S33. Member names are
 * resolved via `members_select_discipline_scoped` (0026), which only
 * covers members who already have a case on file — exactly the set this
 * function ever needs, since every row here already came from
 * `disciplinary_cases`.
 */
export async function listCases(client: SupabaseClient<Database>, options: ListCasesOptions = {}): Promise<CaseSummary[]> {
  let query = client.from("disciplinary_cases").select("*").order("created_at", { ascending: false });
  if (options.status) query = query.eq("status", options.status);
  if (options.memberId) query = query.eq("member_id", options.memberId);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load disciplinary cases.", error);

  const rows = data ?? [];
  const memberNamesById = await resolveMemberNames(client, rows.map((r) => r.member_id));
  return rows.map((row) => mapCaseSummary(row, memberNamesById));
}

export async function getCase(client: SupabaseClient<Database>, id: string): Promise<CaseSummary | null> {
  const { data, error } = await client.from("disciplinary_cases").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the disciplinary case.", error);
  if (!data) return null;

  const memberNamesById = await resolveMemberNames(client, [data.member_id]);
  return mapCaseSummary(data, memberNamesById);
}

export async function listActions(client: SupabaseClient<Database>, caseId: string): Promise<ActionSummary[]> {
  const { data, error } = await client
    .from("disciplinary_actions")
    .select("*")
    .eq("case_id", caseId)
    .order("decided_at", { ascending: false });
  if (error) throw new ServiceError("Could not load disciplinary actions.", error);
  return (data ?? []).map(mapActionSummary);
}

async function resolveMemberNames(
  client: SupabaseClient<Database>,
  memberIds: string[]
): Promise<Map<string, { name: string; memberNumber: string }>> {
  const uniqueIds = [...new Set(memberIds)];
  const memberNamesById = new Map<string, { name: string; memberNumber: string }>();
  if (uniqueIds.length === 0) return memberNamesById;

  const { data, error } = await client.from("members").select("id, first_name, last_name, member_number").in("id", uniqueIds);
  if (error) throw new ServiceError("Could not resolve member names.", error);
  for (const m of data ?? []) {
    memberNamesById.set(m.id, { name: `${m.first_name} ${m.last_name}`, memberNumber: m.member_number });
  }
  return memberNamesById;
}
