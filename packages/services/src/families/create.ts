import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapFamilyRow } from "./map";
import type { CreateFamilyInput, Family } from "./types";

export async function createFamily(client: SupabaseClient<Database>, input: CreateFamilyInput): Promise<Family> {
  const name = input.name.trim();
  if (!name) {
    throw new ServiceError("Family name is required.");
  }

  const { data, error } = await client
    .from("families")
    .insert({
      name,
      description: input.description ?? null,
      leader_user_id: input.leaderUserId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ServiceError(`A family named "${name}" already exists.`, error);
    }
    throw new ServiceError("Could not create the family.", error);
  }

  return mapFamilyRow(data);
}
