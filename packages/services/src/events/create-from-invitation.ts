import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapEventSummary } from "./map";
import type { CreateEventFromInvitationInput, EventSummary } from "./types";

/**
 * PRD §9.2: "Approved → published to internal Calendar... → Technical
 * Rider generated → ...". This function is the ONE downstream artifact
 * this phase actually builds — the `events` row itself (`event_category:
 * 'invitation'`, `status: 'scheduled'`). Technical Rider (§7.9), Gate
 * Pass (§7.6), Logistics Itinerary (§7.25), Member Eligibility (§7.11),
 * and the calendar/department-notification side effects are deferred to
 * the phases that build Technical/Inventory/Logistics themselves (see
 * docs/PHASE_7_5.md §1) — this codebase does not stub a table it can't
 * yet populate meaningfully.
 *
 * Idempotent by `invitation_id` (unique in 0008_invitations_events.sql):
 * if an event already exists for this invitation (e.g. a decision is
 * retried after a partial failure — see decideInvitationApproval()'s own
 * non-atomicity note), returns the existing row rather than erroring.
 */
export async function createEventFromInvitation(
  client: SupabaseClient<Database>,
  input: CreateEventFromInvitationInput
): Promise<EventSummary> {
  const { data: existing, error: existingError } = await client
    .from("events")
    .select("*")
    .eq("invitation_id", input.invitationId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check for an existing event.", existingError);
  if (existing) return mapEventSummary(existing);

  const { data, error } = await client
    .from("events")
    .insert({
      invitation_id: input.invitationId,
      name: input.name,
      event_category: "invitation",
      event_date: input.eventDate,
      start_time: input.startTime ?? null,
      venue: input.venue ?? null,
      location: input.location ?? null,
      status: "scheduled",
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the event from this approved invitation.", error);

  return mapEventSummary(data);
}
