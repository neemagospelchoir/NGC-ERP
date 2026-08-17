import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapLeaveRequestSummary } from "./map";
import type { DecideLeaveRequestInput, LeaveRequestSummary } from "./types";

/**
 * Only from `pending` — like applications' decideApplication(), a
 * decision can't be un-made through this function (correcting a wrong
 * decision is a deliberate follow-up action for a later phase, not a
 * silent status edit). `leave_requests_update_hr` RLS (0006) already
 * requires `attendance.leave.manage`; no application-layer permission
 * check is duplicated here.
 */
export async function decideLeaveRequest(
  client: SupabaseClient<Database>,
  id: string,
  input: DecideLeaveRequestInput
): Promise<LeaveRequestSummary> {
  const { data: current, error: loadError } = await client.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the leave request.", loadError);
  if (!current) throw new ServiceError("Leave request not found.");
  if (current.status !== "pending") {
    throw new ServiceError(`Only a pending leave request can be decided (currently "${current.status}").`);
  }

  const { data, error } = await client
    .from("leave_requests")
    .update({
      status: input.decision,
      approved_by: input.approverId,
      approved_at: new Date().toISOString(),
      approver_comment: input.comment?.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not record the decision.", error);

  const { data: memberRow, error: memberError } = await client
    .from("members")
    .select("id, first_name, last_name, member_number")
    .eq("id", data.member_id)
    .maybeSingle();
  if (memberError) throw new ServiceError("Could not resolve the member.", memberError);

  const memberNamesById = new Map<string, { name: string; memberNumber: string }>();
  if (memberRow) {
    memberNamesById.set(memberRow.id, { name: `${memberRow.first_name} ${memberRow.last_name}`, memberNumber: memberRow.member_number });
  }

  return mapLeaveRequestSummary(data, memberNamesById);
}
