import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getEvent } from "../../events/list";
import { listTechnicalRiders } from "../../technical-riders/list";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Technical Report" (PRD §11, scoped to Technical Riders — the schema
 * has no separate equipment-line-items table to report on, per
 * technical-riders/types.ts's own doc comment). Every rider created in
 * the period — `technical_riders_select_internal` RLS (0009) already lets
 * any signed-in user read every rider, same transparency baseline as
 * Vendors/Assets/Events. Event names are resolved one `getEvent` call per
 * unique event id (a small N — one rider per event, `technical_riders.
 * event_id` is unique — mirroring the Attendance Report's own per-session
 * `Promise.all` resolution pattern rather than adding a new bulk-by-ids
 * function this report is the only caller of).
 */
export async function runTechnicalReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const riders = await listTechnicalRiders(client, { createdFrom: from, createdTo: to });
  const eventIds = [...new Set(riders.map((r) => r.eventId))];
  const events = await Promise.all(eventIds.map((id) => getEvent(client, id)));
  const eventNameById = new Map(events.filter((e) => e !== null).map((e) => [e.id, e.name]));

  return {
    reportKey: "technical",
    title: "Technical Report",
    period: { from, to },
    columns: [
      { key: "event", label: "Event" },
      { key: "preparedBy", label: "Prepared by" },
      { key: "setupTime", label: "Setup time" },
      { key: "soundcheckTime", label: "Soundcheck time" },
      { key: "createdAt", label: "Created" },
    ],
    rows: riders.map((r) => ({
      event: eventNameById.get(r.eventId) ?? "—",
      preparedBy: r.preparedBy ?? "—",
      setupTime: r.setupTime ?? "—",
      soundcheckTime: r.soundcheckTime ?? "—",
      createdAt: r.createdAt.slice(0, 10),
    })),
  };
}
