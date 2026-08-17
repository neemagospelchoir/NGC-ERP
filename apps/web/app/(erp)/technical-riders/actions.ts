"use server";

import { revalidatePath } from "next/cache";
import { auth, technicalRiders } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface TechnicalRiderFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readRiderFields(formData: FormData) {
  return {
    paRequirements: readOptionalString(formData, "paRequirements"),
    lightingRequirements: readOptionalString(formData, "lightingRequirements"),
    ledDisplayRequirements: readOptionalString(formData, "ledDisplayRequirements"),
    cameraRequirements: readOptionalString(formData, "cameraRequirements"),
    recordingRequirements: readOptionalString(formData, "recordingRequirements"),
    powerRequirements: readOptionalString(formData, "powerRequirements"),
    stageRequirements: readOptionalString(formData, "stageRequirements"),
    monitoringRequirements: readOptionalString(formData, "monitoringRequirements"),
    crewNotes: readOptionalString(formData, "crewNotes"),
    setupTime: readOptionalString(formData, "setupTime"),
    soundcheckTime: readOptionalString(formData, "soundcheckTime"),
    technicalNotes: readOptionalString(formData, "technicalNotes"),
  };
}

/**
 * `upsertTechnicalRider` (0009's `event_id unique` constraint) is the same
 * insert-or-update call for both "create the rider for this event" (from
 * `/technical-riders`, no row yet) and "edit this rider" (from
 * `/technical-riders/[id]`, an existing row) — these two actions differ
 * only in which paths they revalidate afterward, matching Vendors/
 * Uniforms' list-page-vs-detail-page action split.
 */
export async function createTechnicalRiderAction(
  _prevState: TechnicalRiderFormState,
  formData: FormData
): Promise<TechnicalRiderFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await technicalRiders.upsertTechnicalRider(supabase, {
      eventId: String(formData.get("eventId") ?? ""),
      ...readRiderFields(formData),
      preparedBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof technicalRiders.ServiceError) return { error: err.message };
    return { error: "Could not create the technical rider." };
  }
  revalidatePath("/technical-riders");
  return {};
}

export async function updateTechnicalRiderAction(
  riderId: string,
  eventId: string,
  _prevState: TechnicalRiderFormState,
  formData: FormData
): Promise<TechnicalRiderFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await technicalRiders.upsertTechnicalRider(supabase, {
      eventId,
      ...readRiderFields(formData),
      preparedBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof technicalRiders.ServiceError) return { error: err.message };
    return { error: "Could not update the technical rider." };
  }
  revalidatePath("/technical-riders");
  revalidatePath(`/technical-riders/${riderId}`);
  return {};
}
