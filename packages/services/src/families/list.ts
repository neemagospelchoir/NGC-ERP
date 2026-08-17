import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapFamilyRow } from "./map";
import type { Family } from "./types";

export interface ListFamiliesOptions {
  includeInactive?: boolean;
}

/**
 * Lists choir families (small-group units, per PRD.md's org structure —
 * distinct from a member's biological family). RLS
 * (`families_read_authenticated`) already limits this to any signed-in
 * user, mirroring departments.
 */
export async function listFamilies(
  client: SupabaseClient<Database>,
  options: ListFamiliesOptions = {}
): Promise<Family[]> {
  let query = client.from("families").select("*").order("name", { ascending: true });
  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new ServiceError("Could not load families.", error);
  }
  return (data ?? []).map(mapFamilyRow);
}

export async function getFamily(client: SupabaseClient<Database>, id: string): Promise<Family | null> {
  const { data, error } = await client.from("families").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new ServiceError("Could not load the family.", error);
  }
  return data ? mapFamilyRow(data) : null;
}
