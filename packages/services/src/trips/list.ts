import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTripRow } from "./map";
import type { Trip } from "./types";

export interface ListTripsOptions {
  eventId?: string;
  /** Inclusive `created_at` range — added for Phase 13.2's Logistics Report, the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

export async function listTrips(client: SupabaseClient<Database>, options: ListTripsOptions = {}): Promise<Trip[]> {
  let query = client.from("trips").select("*").order("created_at", { ascending: false });
  if (options.eventId) query = query.eq("event_id", options.eventId);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load trips.", error);
  return (data ?? []).map(mapTripRow);
}

export async function getTrip(client: SupabaseClient<Database>, id: string): Promise<Trip | null> {
  const { data, error } = await client.from("trips").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the trip.", error);
  return data ? mapTripRow(data) : null;
}
