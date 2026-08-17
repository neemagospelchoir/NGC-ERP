import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapItineraryRow } from "./map";
import type { GenerateItineraryInput, Itinerary } from "./types";

/**
 * `itineraries.trip_id` is `unique` (0013) — one itinerary per trip. Unlike
 * `upsertTechnicalRider` (which folds create-or-edit into a single call
 * because the whole rider form is replaced wholesale), generating an
 * itinerary and editing its member list afterward are kept as two distinct
 * actions (`generateItinerary` here, `updateItinerary` in `update.ts`) —
 * matching `createPlaylist`/`updatePlaylist`'s split, since re-running
 * "generate" against an existing itinerary is a meaningfully different,
 * more consequential action (a fresh generation event, `generated_at`)
 * than quietly patching the member list, and PRD §7.x's phrasing ("Auto-
 * generated Itinerary") treats generation as an explicit, named step.
 *
 * `generated_document_id` is never set here (see `Itinerary`'s own doc
 * comment in `types.ts`) — no PDF/document-generation module exists yet
 * for any phase to call into (ARCHITECTURE.md).
 */
export async function generateItinerary(
  client: SupabaseClient<Database>,
  input: GenerateItineraryInput
): Promise<Itinerary> {
  if (!input.tripId) throw new ServiceError("A trip is required.");

  const { data: existing, error: existingError } = await client
    .from("itineraries")
    .select("id")
    .eq("trip_id", input.tripId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check for an existing itinerary.", existingError);
  if (existing) throw new ServiceError("This trip already has an itinerary — edit it instead of generating a new one.");

  const { data, error } = await client
    .from("itineraries")
    .insert({
      trip_id: input.tripId,
      assigned_member_ids: input.assignedMemberIds ?? [],
      notes: input.notes ?? null,
      // Explicit, not omitted — see this codebase's established lesson
      // (Playlists' `shared_with_roles`, docs/PHASE_8_4.md §2.2/§4) that
      // omitting a nullable column and relying on it "just being null"
      // works against real Postgres but not against the unit-test fake
      // client or the e2e mock, neither of which apply column defaults or
      // synthesize an absent key as `null`.
      generated_document_id: null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not generate the itinerary.", error);
  return mapItineraryRow(data);
}
