import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTripRow } from "./map";
import type { CreateTripInput, Trip } from "./types";

/**
 * Unlike Technical Rider/Playlist/Gate Pass, `trips.event_id` has NO unique
 * constraint (0013) — an event can legitimately have more than one trip
 * (separate transport for different groups, a multi-leg tour, etc.), so
 * this is a plain create, the same shape as `createVendor`/`createAsset`,
 * not a check-then-upsert.
 */
export async function createTrip(client: SupabaseClient<Database>, input: CreateTripInput): Promise<Trip> {
  if (!input.eventId) throw new ServiceError("An event is required.");

  const { data, error } = await client
    .from("trips")
    .insert({
      event_id: input.eventId,
      destination: input.destination ?? null,
      vehicle_requirement: input.vehicleRequirement ?? null,
      driver_name: input.driverName ?? null,
      transport_vendor_id: input.transportVendorId ?? null,
      accommodation_vendor_id: input.accommodationVendorId ?? null,
      departure_at: input.departureAt ?? null,
      arrival_at: input.arrivalAt ?? null,
      return_departure_at: input.returnDepartureAt ?? null,
      return_arrival_at: input.returnArrivalAt ?? null,
      estimated_cost: input.estimatedCost ?? null,
      actual_cost: input.actualCost ?? null,
      currency: input.currency?.trim() || "TZS",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the trip.", error);
  return mapTripRow(data);
}
