import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapItineraryRow } from "./map";
import type { Itinerary, UpdateItineraryInput } from "./types";

export async function updateItinerary(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateItineraryInput
): Promise<Itinerary> {
  const fields: Database["public"]["Tables"]["itineraries"]["Update"] = {};
  if (input.assignedMemberIds !== undefined) fields.assigned_member_ids = input.assignedMemberIds;
  if (input.notes !== undefined) fields.notes = input.notes;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("itineraries").update(fields).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the itinerary.", error);
  return mapItineraryRow(data);
}
