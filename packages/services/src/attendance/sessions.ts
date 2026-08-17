import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapSessionSummary } from "./map";
import type { AttendanceSessionSummary, CreateSessionInput, ListSessionsOptions } from "./types";

async function resolveDepartmentNames(
  client: SupabaseClient<Database>,
  departmentIds: string[]
): Promise<Map<string, string>> {
  const departmentNamesById = new Map<string, string>();
  const ids = [...new Set(departmentIds)];
  if (ids.length === 0) return departmentNamesById;

  const { data, error } = await client.from("departments").select("id, name").in("id", ids);
  if (error) throw new ServiceError("Could not resolve department names.", error);
  for (const d of data ?? []) departmentNamesById.set(d.id, d.name);
  return departmentNamesById;
}

/**
 * No application-layer permission check — `attendance_sessions_write_scoped`
 * RLS (0006) already requires `attendance.records.manage` OR that the
 * session's department is in the caller's own scoped departments (a
 * department leader creating a session for their own department). Trusting
 * Postgres here, same pattern as every list/write function in this
 * codebase since Phase 7.1.
 */
export async function createSession(
  client: SupabaseClient<Database>,
  input: CreateSessionInput
): Promise<AttendanceSessionSummary> {
  const title = input.title.trim();
  if (!title) {
    throw new ServiceError("A session title is required.");
  }

  const { data, error } = await client
    .from("attendance_sessions")
    .insert({
      session_type: input.sessionType,
      title,
      department_id: input.departmentId ?? null,
      session_date: input.sessionDate,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not create the attendance session.", error);

  const departmentNamesById = await resolveDepartmentNames(client, data.department_id ? [data.department_id] : []);
  return mapSessionSummary(data, departmentNamesById);
}

/**
 * `attendance_sessions_select_scoped` RLS (0006) already limits results to:
 * whole-choir sessions, sessions in the caller's own department scope, or
 * anyone holding `attendance.records.read_all` — same "trust Postgres"
 * pattern as listMembers()/listApplications().
 */
export async function listSessions(
  client: SupabaseClient<Database>,
  options: ListSessionsOptions = {}
): Promise<AttendanceSessionSummary[]> {
  let query = client.from("attendance_sessions").select("*").order("session_date", { ascending: false });

  if (options.departmentId) query = query.eq("department_id", options.departmentId);
  if (options.from) query = query.gte("session_date", options.from);
  if (options.to) query = query.lte("session_date", options.to);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load attendance sessions.", error);

  const rows = data ?? [];
  const departmentNamesById = await resolveDepartmentNames(
    client,
    rows.map((r) => r.department_id).filter((id): id is string => !!id)
  );
  return rows.map((row) => mapSessionSummary(row, departmentNamesById));
}

export async function getSession(client: SupabaseClient<Database>, id: string): Promise<AttendanceSessionSummary | null> {
  const { data, error } = await client.from("attendance_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the attendance session.", error);
  if (!data) return null;

  const departmentNamesById = await resolveDepartmentNames(client, data.department_id ? [data.department_id] : []);
  return mapSessionSummary(data, departmentNamesById);
}
