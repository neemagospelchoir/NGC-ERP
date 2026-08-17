import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTripRow } from "./map";
import type { Trip, UpdateTripInput } from "./types";

export async function updateTrip(client: SupabaseClient<Database>, id: string, input: UpdateTripInput): Promise<Trip> {
  const fields: Database["public"]["Tables"]["trips"]["Update"] = {};
  if (input.destination !== undefined) fields.destination = input.destination;
  if (input.vehicleRequirement !== undefined) fields.vehicle_requirement = input.vehicleRequirement;
  if (input.driverName !== undefined) fields.driver_name = input.driverName;
  if (input.transportVendorId !== undefined) fields.transport_vendor_id = input.transportVendorId;
  if (input.accommodationVendorId !== undefined) fields.accommodation_vendor_id = input.accommodationVendorId;
  if (input.departureAt !== undefined) fields.departure_at = input.departureAt;
  if (input.arrivalAt !== undefined) fields.arrival_at = input.arrivalAt;
  if (input.returnDepartureAt !== undefined) fields.return_departure_at = input.returnDepartureAt;
  if (input.returnArrivalAt !== undefined) fields.return_arrival_at = input.returnArrivalAt;
  if (input.estimatedCost !== undefined) fields.estimated_cost = input.estimatedCost;
  if (input.actualCost !== undefined) fields.actual_cost = input.actualCost;
  if (input.currency !== undefined) {
    const currency = input.currency.trim();
    if (!currency) throw new ServiceError("Currency cannot be blank.");
    fields.currency = currency;
  }
  if (input.notes !== undefined) fields.notes = input.notes;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("trips").update(fields).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the trip.", error);
  return mapTripRow(data);
}
