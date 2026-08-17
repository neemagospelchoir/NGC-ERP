import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapLeaveRequestSummary } from "./map";
import type { CreateLeaveRequestInput, LeaveRequestSummary } from "./types";

/**
 * `leave_requests_insert_self` RLS (0006) already restricts the INSERT to
 * `member_id in (select id from members where user_id = auth.uid())` — a
 * caller cannot create a leave request for anyone but themself, enforced
 * by Postgres, not by trusting the `memberId` this function is handed.
 */
export async function createLeaveRequest(
  client: SupabaseClient<Database>,
  input: CreateLeaveRequestInput
): Promise<LeaveRequestSummary> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ServiceError("A reason is required.");
  }
  if (input.endDate < input.startDate) {
    throw new ServiceError("The end date cannot be before the start date.");
  }

  const { data, error } = await client
    .from("leave_requests")
    .insert({
      member_id: input.memberId,
      leave_type: input.leaveType,
      reason,
      start_date: input.startDate,
      end_date: input.endDate,
      // Explicit, not relying on the column default (0006 defaults to
      // 'pending' too) — same "don't trust an untested default" rationale
      // as members.createMember()'s explicit probation status.
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not submit the leave request.", error);

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
