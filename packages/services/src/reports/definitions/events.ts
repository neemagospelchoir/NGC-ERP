import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listEvents } from "../../events/list";
import type { EventStatus } from "../../events/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Event Report" (PRD §11). Every event scheduled within the period, by
 * `event_date` — `listEvents` already supports an inclusive `from`/`to`
 * range (added for Phase 10.3's Calendar), so this report adds nothing
 * beyond resolving the period and calling that existing, unchanged,
 * RLS-scoped function (`events_select_internal`, 0008 — any signed-in
 * user, the same transparency baseline as Vendors/Assets/Uniforms).
 * `filters.status` narrows by `EventStatus`.
 */
export async function runEventsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const events = await listEvents(client, { from, to, status: filters.status as EventStatus | undefined });

  return {
    reportKey: "events",
    title: "Event Report",
    period: { from, to },
    columns: [
      { key: "name", label: "Event" },
      { key: "eventCategory", label: "Category" },
      { key: "eventDate", label: "Date" },
      { key: "venue", label: "Venue" },
      { key: "status", label: "Status" },
    ],
    rows: events.map((e) => ({
      name: e.name,
      eventCategory: e.eventCategory,
      eventDate: e.eventDate,
      venue: e.venue ?? "—",
      status: e.status,
    })),
  };
}
