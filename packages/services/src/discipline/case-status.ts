import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapCaseSummary } from "./map";
import type { CaseStatus, CaseSummary } from "./types";

/**
 * Forward-only, same shape as applications/review.ts's FORWARD_TRANSITIONS
 * — no jump-ahead, no going back. `action_decided` is normally reached
 * automatically by record-action.ts's recordAction() the moment the first
 * action is logged (PRD §9.4's flow has no separate manual step for it),
 * but is also listed here so a case that somehow needs re-flagging isn't
 * stuck if that automatic step is ever bypassed.
 */
const FORWARD_TRANSITIONS: Partial<Record<CaseStatus, CaseStatus[]>> = {
  open: ["under_investigation", "action_decided"],
  under_investigation: ["action_decided"],
  action_decided: ["resolved"],
  resolved: ["closed"],
};

export async function advanceCaseStatus(client: SupabaseClient<Database>, caseId: string, next: CaseStatus): Promise<CaseSummary> {
  const { data: current, error: loadError } = await client.from("disciplinary_cases").select("*").eq("id", caseId).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the disciplinary case.", loadError);
  if (!current) throw new ServiceError("Disciplinary case not found.");

  const allowed = FORWARD_TRANSITIONS[current.status as CaseStatus] ?? [];
  if (!allowed.includes(next)) {
    throw new ServiceError(`Cannot move a case from "${current.status}" to "${next}".`);
  }

  const { data, error } = await client.from("disciplinary_cases").update({ status: next }).eq("id", caseId).select("*").single();
  if (error) throw new ServiceError("Could not update the case status.", error);

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("id, first_name, last_name, member_number")
    .eq("id", data.member_id)
    .single();
  if (memberError) throw new ServiceError("Could not re-read the member.", memberError);

  return mapCaseSummary(
    data,
    new Map([[memberRow.id, { name: `${memberRow.first_name} ${memberRow.last_name}`, memberNumber: memberRow.member_number }]])
  );
}
