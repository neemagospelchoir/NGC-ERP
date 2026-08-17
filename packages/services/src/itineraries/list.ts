import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapItineraryRow } from "./map";
import type { Itinerary } from "./types";

export async function getItinerary(client: SupabaseClient<Database>, id: string): Promise<Itinerary | null> {
  const { data, error } = await client.from("itineraries").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the itinerary.", error);
  return data ? mapItineraryRow(data) : null;
}

export async function getItineraryForTrip(client: SupabaseClient<Database>, tripId: string): Promise<Itinerary | null> {
  const { data, error } = await client.from("itineraries").select("*").eq("trip_id", tripId).maybeSingle();
  if (error) throw new ServiceError("Could not load the itinerary.", error);
  return data ? mapItineraryRow(data) : null;
}
