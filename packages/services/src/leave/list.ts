import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapLeaveRequestSummary } from "./map";
import type { LeaveRequestSummary, ListLeaveRequestsOptions } from "./types";

async function resolveMemberNames(
  client: SupabaseClient<Database>,
  memberIds: string[]
): Promise<Map<string, { name: string; memberNumber: string }>> {
  const memberNamesById = new Map<string, { name: string; memberNumber: string }>();
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return memberNamesById;

  const { data, error } = await client.from("members").select("id, first_name, last_name, member_number").in("id", ids);
  if (error) throw new ServiceError("Could not resolve member names.", error);
  for (const m of data ?? []) memberNamesById.set(m.id, { name: `${m.first_name} ${m.last_name}`, memberNumber: m.member_number });
  return memberNamesById;
}

/**
 * `leave_requests_select_scoped` RLS (0006) already limits results to: the
 * caller's own requests, anyone holding `attendance.leave.manage`, or a
 * Department Leader viewing requests from members in their own department
 * scope — same "trust Postgres" pattern as every list function since
 * Phase 7.1. Callers pass `memberId` explicitly to scope "my own requests"
 * (the UI resolves that from the signed-in user's own member record, not
 * from an app-layer permission check here).
 */
export async function listLeaveRequests(
  client: SupabaseClient<Database>,
  options: ListLeaveRequestsOptions = {}
): Promise<LeaveRequestSummary[]> {
  let query = client.from("leave_requests").select("*").order("created_at", { ascending: false });
  if (options.memberId) query = query.eq("member_id", options.memberId);
  if (options.status) query = query.eq("status", options.status);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load leave requests.", error);

  const rows = data ?? [];
  const memberNamesById = await resolveMemberNames(client, rows.map((r) => r.member_id));
  return rows.map((row) => mapLeaveRequestSummary(row, memberNamesById));
}

export async function getLeaveRequest(client: SupabaseClient<Database>, id: string): Promise<LeaveRequestSummary | null> {
  const { data, error } = await client.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the leave request.", error);
  if (!data) return null;

  const memberNamesById = await resolveMemberNames(client, [data.member_id]);
  return mapLeaveRequestSummary(data, memberNamesById);
}
