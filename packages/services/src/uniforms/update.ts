import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapUniformRow } from "./map";
import type { Uniform, UniformCondition, UpdateUniformInput } from "./types";

/**
 * Updates a uniform registry entry. When the patch touches either
 * quantity field, both are re-validated together against the row's
 * CURRENT values (not just the patched one in isolation) — otherwise a
 * caller patching only `quantityAvailable` to something above the
 * existing `quantityTotal` (or vice versa) would silently create an
 * inconsistent row no other function in this module checks for again.
 */
export async function updateUniform(client: SupabaseClient<Database>, id: string, input: UpdateUniformInput): Promise<Uniform> {
  const patch: Database["public"]["Tables"]["uniforms"]["Update"] = {};
  if (input.uniformType !== undefined) {
    const trimmed = input.uniformType.trim();
    if (!trimmed) throw new ServiceError("Uniform type cannot be empty.");
    patch.uniform_type = trimmed;
  }
  if (input.size !== undefined) patch.size = input.size;
  if (input.storageLocation !== undefined) patch.storage_location = input.storageLocation;

  if (input.quantityTotal !== undefined || input.quantityAvailable !== undefined) {
    const { data: current, error: currentError } = await client
      .from("uniforms")
      .select("quantity_total, quantity_available")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw new ServiceError("Could not load the uniform.", currentError);
    if (!current) throw new ServiceError("Uniform not found.");

    const nextTotal = input.quantityTotal ?? current.quantity_total;
    const nextAvailable = input.quantityAvailable ?? current.quantity_available;
    if (nextTotal < 0 || nextAvailable < 0) throw new ServiceError("Quantities cannot be negative.");
    if (nextAvailable > nextTotal) throw new ServiceError("Available quantity cannot exceed total quantity.");

    if (input.quantityTotal !== undefined) patch.quantity_total = nextTotal;
    if (input.quantityAvailable !== undefined) patch.quantity_available = nextAvailable;
  }

  const { data, error } = await client.from("uniforms").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the uniform.", error);
  return mapUniformRow(data);
}

/**
 * `retired` is treated as terminal, same principle as an asset's
 * `disposed` state (docs/PHASE_8_1.md §2.2): once retired, this entry's
 * stock is zeroed out of circulation so `assignUniform` can never issue
 * more of it, even though (unlike `assets.disposed`) the schema doesn't
 * have a dedicated availability flag to block on — `quantityAvailable = 0`
 * is the mechanism here. `quantityTotal` is left untouched as a historical
 * record of how much was ever owned.
 */
export async function setUniformCondition(client: SupabaseClient<Database>, id: string, condition: UniformCondition): Promise<Uniform> {
  const patch: Database["public"]["Tables"]["uniforms"]["Update"] = { condition };
  if (condition === "retired") {
    patch.quantity_available = 0;
  }
  const { data, error } = await client.from("uniforms").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the uniform's condition.", error);
  return mapUniformRow(data);
}
