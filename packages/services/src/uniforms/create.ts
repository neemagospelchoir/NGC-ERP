import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapUniformRow } from "./map";
import type { CreateUniformInput, Uniform } from "./types";

/**
 * Creates a uniform registry entry. `uniformType` is validated against the
 * real, active `lookup_values(category='uniform_category')` codes rather
 * than only checked for non-blankness — the `uniforms` table has no FK/
 * check constraint tying it to `lookup_values` (deliberately
 * admin-configurable free text, same as Attendance's `status_code`), so
 * without this an already-authorized caller could persist an arbitrary
 * string that every list/filter UI would then silently fail to label
 * (same class of gap `recordAttendance`'s security-review fix closed).
 *
 * `quantityAvailable` is not caller-supplied — a brand-new registry entry
 * starts with its entire stock available; it only decreases once
 * `assignUniform` issues some of it out.
 */
export async function createUniform(client: SupabaseClient<Database>, input: CreateUniformInput): Promise<Uniform> {
  const uniformType = input.uniformType.trim();
  if (!uniformType) throw new ServiceError("A uniform type is required.");
  if (!Number.isFinite(input.quantityTotal) || input.quantityTotal < 0) {
    throw new ServiceError("Total quantity must be zero or a positive number.");
  }

  const { data: typeRow, error: typeError } = await client
    .from("lookup_values")
    .select("id")
    .eq("category", "uniform_category")
    .eq("code", uniformType)
    .eq("is_active", true)
    .maybeSingle();
  if (typeError) throw new ServiceError("Could not verify the uniform type.", typeError);
  if (!typeRow) throw new ServiceError(`"${uniformType}" is not a recognized uniform type.`);

  const { data, error } = await client
    .from("uniforms")
    .insert({
      uniform_type: uniformType,
      size: input.size ?? null,
      quantity_total: input.quantityTotal,
      quantity_available: input.quantityTotal,
      condition: input.condition ?? "new",
      storage_location: input.storageLocation ?? null,
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not create the uniform registry entry.", error);
  return mapUniformRow(data);
}
