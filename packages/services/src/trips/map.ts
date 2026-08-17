import type { Database } from "@ngc/db";
import type { Trip } from "./types";

type Row = Database["public"]["Tables"]["trips"]["Row"];

export function mapTripRow(row: Row): Trip {
  return {
    id: row.id,
    eventId: row.event_id,
    destination: row.destination,
    vehicleRequirement: row.vehicle_requirement,
    driverName: row.driver_name,
    transportVendorId: row.transport_vendor_id,
    accommodationVendorId: row.accommodation_vendor_id,
    departureAt: row.departure_at,
    arrivalAt: row.arrival_at,
    returnDepartureAt: row.return_departure_at,
    returnArrivalAt: row.return_arrival_at,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    currency: row.currency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
