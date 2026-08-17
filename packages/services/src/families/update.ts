import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapFamilyRow } from "./map";
import type { Family, UpdateFamilyInput } from "./types";

export async function updateFamily(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateFamilyInput
): Promise<Family> {
  const patch: Database["public"]["Tables"]["families"]["Update"] = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError("Family name cannot be empty.");
    patch.name = trimmed;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.leaderUserId !== undefined) patch.leader_user_id = input.leaderUserId;

  const { data, error } = await client.from("families").update(patch).eq("id", id).select("*").single();

  if (error) {
    throw new ServiceError("Could not update the family.", error);
  }
  return mapFamilyRow(data);
}

/** Never hard-deleted — same rationale as departments (see departments/update.ts). */
export async function deactivateFamily(client: SupabaseClient<Database>, id: string): Promise<Family> {
  return updateFamilyActiveState(client, id, false);
}

export async function reactivateFamily(client: SupabaseClient<Database>, id: string): Promise<Family> {
  return updateFamilyActiveState(client, id, true);
}

async function updateFamilyActiveState(
  client: SupabaseClient<Database>,
  id: string,
  isActive: boolean
): Promise<Family> {
  const { data, error } = await client.from("families").update({ is_active: isActive }).eq("id", id).select("*").single();

  if (error) {
    throw new ServiceError(isActive ? "Could not reactivate the family." : "Could not deactivate the family.", error);
  }
  return mapFamilyRow(data);
}
