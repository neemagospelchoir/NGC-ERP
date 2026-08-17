import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapUniformAssignmentRow, mapUniformRow } from "./map";
import type { Uniform, UniformAssignment, UniformCondition } from "./types";

/**
 * `uniforms_select_internal` RLS (0012) lets any signed-in user read the
 * catalog — no application-layer permission check duplicated here, same
 * "trust Postgres" pattern as every other list function in this codebase.
 */
export interface ListUniformsOptions {
  condition?: UniformCondition;
}

export async function listUniforms(client: SupabaseClient<Database>, options: ListUniformsOptions = {}): Promise<Uniform[]> {
  let query = client.from("uniforms").select("*").order("uniform_type", { ascending: true });
  if (options.condition) query = query.eq("condition", options.condition);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load uniforms.", error);
  return (data ?? []).map(mapUniformRow);
}

export async function getUniform(client: SupabaseClient<Database>, id: string): Promise<Uniform | null> {
  const { data, error } = await client.from("uniforms").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the uniform.", error);
  return data ? mapUniformRow(data) : null;
}

/**
 * `uniform_assignments_select_scoped` RLS (0012) narrows the result set to
 * the caller's own assignments, their department-leader scope, or
 * `uniform.inventory.manage` — meaning this function returns a DIFFERENT
 * slice of the same uniform's history depending on who calls it. That is
 * deliberate: a plain member browsing a uniform's detail page sees only
 * their own row (if any), a Department Leader sees their department's
 * rows too, and Super Admin/anyone holding `uniform.inventory.manage`
 * sees everything — all from the same query, with no application-layer
 * branching needed.
 */
export async function listUniformAssignments(client: SupabaseClient<Database>, uniformId: string): Promise<UniformAssignment[]> {
  const { data, error } = await client
    .from("uniform_assignments")
    .select("*")
    .eq("uniform_id", uniformId)
    .order("assigned_at", { ascending: false });
  if (error) throw new ServiceError("Could not load this uniform's assignment history.", error);
  return (data ?? []).map(mapUniformAssignmentRow);
}

export async function listAssignmentsForMember(client: SupabaseClient<Database>, memberId: string): Promise<UniformAssignment[]> {
  const { data, error } = await client
    .from("uniform_assignments")
    .select("*")
    .eq("member_id", memberId)
    .order("assigned_at", { ascending: false });
  if (error) throw new ServiceError("Could not load this member's uniform assignments.", error);
  return (data ?? []).map(mapUniformAssignmentRow);
}

export interface ListUniformAssignmentsOptions {
  assignedFrom?: string;
  assignedTo?: string;
}

export interface UniformAssignmentWithNames extends UniformAssignment {
  memberName: string;
  uniformLabel: string;
}

/**
 * Every uniform issue across every uniform/member within a period, not
 * scoped to one uniform or one member the way `listUniformAssignments`/
 * `listAssignmentsForMember` are — used by the Uniform Report (Phase
 * 13.2). Deliberately issues no new RLS: `uniform_assignments_select_
 * scoped` (0012) already governs this exactly as it governs those two
 * narrower functions (self, department-leader scope, or `uniform.
 * inventory.manage`) — the report's own filter widens nothing.
 */
export async function listUniformAssignmentsInPeriod(
  client: SupabaseClient<Database>,
  options: ListUniformAssignmentsOptions = {}
): Promise<UniformAssignmentWithNames[]> {
  let query = client.from("uniform_assignments").select("*").order("assigned_at", { ascending: false });
  if (options.assignedFrom) query = query.gte("assigned_at", options.assignedFrom);
  if (options.assignedTo) query = query.lte("assigned_at", options.assignedTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load uniform assignments.", error);
  const rows = (data ?? []).map(mapUniformAssignmentRow);
  if (rows.length === 0) return [];

  const [memberNamesById, uniformLabelsById] = await Promise.all([
    resolveMemberNames(client, rows.map((r) => r.memberId)),
    resolveUniformLabels(client, rows.map((r) => r.uniformId)),
  ]);

  return rows.map((row) => ({
    ...row,
    memberName: memberNamesById.get(row.memberId) ?? "Unknown member",
    uniformLabel: uniformLabelsById.get(row.uniformId) ?? "Unknown uniform",
  }));
}

async function resolveMemberNames(client: SupabaseClient<Database>, memberIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(memberIds)];
  const namesById = new Map<string, string>();
  if (ids.length === 0) return namesById;
  const { data, error } = await client.from("members").select("id, first_name, last_name").in("id", ids);
  if (error) throw new ServiceError("Could not resolve member names.", error);
  for (const m of data ?? []) namesById.set(m.id, `${m.first_name} ${m.last_name}`);
  return namesById;
}

async function resolveUniformLabels(client: SupabaseClient<Database>, uniformIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(uniformIds)];
  const labelsById = new Map<string, string>();
  if (ids.length === 0) return labelsById;
  const { data, error } = await client.from("uniforms").select("id, uniform_type, size").in("id", ids);
  if (error) throw new ServiceError("Could not resolve uniform labels.", error);
  for (const u of data ?? []) labelsById.set(u.id, u.size ? `${u.uniform_type} (${u.size})` : u.uniform_type);
  return labelsById;
}
