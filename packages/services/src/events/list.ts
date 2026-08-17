import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapEventSummary } from "./map";
import type { EventStatus, EventSummary } from "./types";

export interface ListEventsOptions {
  status?: EventStatus;
  /** Inclusive `event_date` range — added for Phase 10.3's Calendar aggregation, mirrors `attendance.ListSessionsOptions`. */
  from?: string;
  to?: string;
}

export async function listEvents(client: SupabaseClient<Database>, options: ListEventsOptions = {}): Promise<EventSummary[]> {
  let query = client.from("events").select("*").order("event_date", { ascending: true });
  if (options.status) query = query.eq("status", options.status);
  if (options.from) query = query.gte("event_date", options.from);
  if (options.to) query = query.lte("event_date", options.to);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load events.", error);
  return (data ?? []).map(mapEventSummary);
}

export async function getEvent(client: SupabaseClient<Database>, id: string): Promise<EventSummary | null> {
  const { data, error } = await client.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the event.", error);
  return data ? mapEventSummary(data) : null;
}

export async function getEventByInvitationId(client: SupabaseClient<Database>, invitationId: string): Promise<EventSummary | null> {
  const { data, error } = await client.from("events").select("*").eq("invitation_id", invitationId).maybeSingle();
  if (error) throw new ServiceError("Could not load the event for this invitation.", error);
  return data ? mapEventSummary(data) : null;
}

/**
 * "Event assignments" self-service (ARCHITECTURE.md §9's mobile V1 list):
 * the events a member has actually been assigned to, via `event_participants`
 * (Phase 7.5 — `assignment_source` distinguishes manual assignment from an
 * eligibility recommendation/override, though this function only needs the
 * event each row points at). `event_participants_select_scoped` RLS (0008,
 * narrowed in Phase 14.1's 0037) limits a caller to their OWN member's rows
 * (or any `events.eligibility.manage` holder's full read) — this function's
 * every caller (mobile's Events tab, web's Playlists page) already passes
 * the signed-in user's own `memberId`, so narrowing the policy changed
 * nothing here; the RLS is simply no longer broader than what this
 * function (or any other shipped caller) actually relies on.
 * Two queries rather than a single embedded select, matching this
 * codebase's existing "batch-resolve related rows" convention
 * (`resolveDepartmentAndFamilyNames`) rather than relying on a PostgREST
 * embed shape that isn't exercised anywhere else in this module.
 */
export async function listEventAssignmentsForMember(client: SupabaseClient<Database>, memberId: string): Promise<EventSummary[]> {
  const { data: participantRows, error: participantError } = await client
    .from("event_participants")
    .select("event_id")
    .eq("member_id", memberId);
  if (participantError) throw new ServiceError("Could not load your event assignments.", participantError);

  const eventIds = [...new Set((participantRows ?? []).map((row) => row.event_id))];
  if (eventIds.length === 0) return [];

  const { data: eventRows, error: eventsError } = await client.from("events").select("*").in("id", eventIds).order("event_date", { ascending: true });
  if (eventsError) throw new ServiceError("Could not load your assigned events.", eventsError);
  return (eventRows ?? []).map(mapEventSummary);
}
