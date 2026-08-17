import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listEvents } from "../events/list";
import { listSessions } from "../attendance/sessions";
import { listCampaigns } from "../contributions/list";
import type { CalendarItem, ListCalendarItemsOptions } from "./types";

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  invitation: "Invitation",
  worship_in_spirit: "Worship in Spirit",
  internal_performance: "Internal Performance",
  community_outreach: "Community Outreach",
  other: "Event",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  rehearsal: "Rehearsal",
  meeting: "Meeting",
  department_meeting: "Department Meeting",
  other: "Session",
};

/**
 * Aggregates three pre-existing, independently-RLS-governed sources into
 * one agenda: `events` (Phase 7.5), `attendance_sessions` (Phase 7.3), and
 * `contribution_campaigns.deadline` (Phase 9.1). This module adds no new
 * table, RLS policy, or RPC of its own — it is a pure read-side composition
 * that calls each source module's own already-scoped list function (so a
 * department leader who can only see their own department's attendance
 * sessions sees exactly that here too, unchanged), then merges and sorts
 * the results by date. Cancelled events/sessions are still included (a
 * cancelled item on your calendar is information, not noise to hide) but
 * closed/cancelled/draft contribution campaigns are excluded — a deadline
 * that no longer applies has no place on an agenda.
 */
export async function listCalendarItems(client: SupabaseClient<Database>, options: ListCalendarItemsOptions): Promise<CalendarItem[]> {
  const { from, to } = options;
  const wantsType = (type: CalendarItem["type"]) => !options.types || options.types.includes(type);

  const [events, sessions, campaigns] = await Promise.all([
    wantsType("event") ? listEvents(client, { from, to }) : Promise.resolve([]),
    wantsType("attendance_session") ? listSessions(client, { from, to }) : Promise.resolve([]),
    wantsType("contribution_deadline") ? listCampaigns(client, { deadlineFrom: from, deadlineTo: to }) : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [];

  for (const event of events) {
    items.push({
      id: `event:${event.id}`,
      type: "event",
      date: event.eventDate,
      title: event.name,
      subtitle: `${EVENT_CATEGORY_LABELS[event.eventCategory] ?? event.eventCategory} · ${event.status}`,
      href: `/events/${event.id}`,
    });
  }

  for (const session of sessions) {
    items.push({
      id: `attendance_session:${session.id}`,
      type: "attendance_session",
      date: session.sessionDate,
      title: session.title,
      subtitle: `${SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType}${session.departmentName ? ` · ${session.departmentName}` : " · Whole choir"}`,
      href: `/attendance/${session.id}`,
    });
  }

  for (const campaign of campaigns) {
    if (!campaign.deadline || campaign.status !== "active") continue;
    items.push({
      id: `contribution_deadline:${campaign.id}`,
      type: "contribution_deadline",
      date: campaign.deadline,
      title: `${campaign.name} — contribution deadline`,
      subtitle: "Contribution campaign deadline",
      href: `/contributions/${campaign.id}`,
    });
  }

  items.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date.localeCompare(b.date)));
  return items;
}
