"use server";

import { revalidatePath } from "next/cache";
import { itineraries, trips } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface TripFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readOptionalNumber(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (value === null || String(value).trim() === "") return null;
  return Number(value);
}

function readTripFields(formData: FormData) {
  return {
    destination: readOptionalString(formData, "destination"),
    vehicleRequirement: readOptionalString(formData, "vehicleRequirement"),
    driverName: readOptionalString(formData, "driverName"),
    transportVendorId: readOptionalString(formData, "transportVendorId"),
    accommodationVendorId: readOptionalString(formData, "accommodationVendorId"),
    departureAt: readOptionalString(formData, "departureAt"),
    arrivalAt: readOptionalString(formData, "arrivalAt"),
    returnDepartureAt: readOptionalString(formData, "returnDepartureAt"),
    returnArrivalAt: readOptionalString(formData, "returnArrivalAt"),
    estimatedCost: readOptionalNumber(formData, "estimatedCost"),
    actualCost: readOptionalNumber(formData, "actualCost"),
    currency: String(formData.get("currency") ?? "").trim() || undefined,
    notes: readOptionalString(formData, "notes"),
  };
}

export async function createTripAction(_prevState: TripFormState, formData: FormData): Promise<TripFormState> {
  const supabase = await createClient();
  try {
    await trips.createTrip(supabase, {
      eventId: String(formData.get("eventId") ?? ""),
      ...readTripFields(formData),
    });
  } catch (err) {
    if (err instanceof trips.ServiceError) return { error: err.message };
    return { error: "Could not create the trip." };
  }
  revalidatePath("/trips");
  return {};
}

export async function updateTripAction(tripId: string, _prevState: TripFormState, formData: FormData): Promise<TripFormState> {
  const supabase = await createClient();
  try {
    await trips.updateTrip(supabase, tripId, readTripFields(formData));
  } catch (err) {
    if (err instanceof trips.ServiceError) return { error: err.message };
    return { error: "Could not update the trip." };
  }
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function generateItineraryAction(
  tripId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const supabase = await createClient();
  try {
    const assignedMemberIds = String(formData.get("assignedMemberIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    await itineraries.generateItinerary(supabase, {
      tripId,
      assignedMemberIds,
      notes: readOptionalString(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof itineraries.ServiceError) return { error: err.message };
    return { error: "Could not generate the itinerary." };
  }
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function updateItineraryAction(
  tripId: string,
  itineraryId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const supabase = await createClient();
  try {
    const assignedMemberIds = String(formData.get("assignedMemberIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    await itineraries.updateItinerary(supabase, itineraryId, {
      assignedMemberIds,
      notes: readOptionalString(formData, "notes"),
    });
  } catch (err) {
    if (err instanceof itineraries.ServiceError) return { error: err.message };
    return { error: "Could not update the itinerary." };
  }
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  return {};
}
