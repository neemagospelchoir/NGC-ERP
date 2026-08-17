import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listTrips } from "../../trips/list";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Logistics Report" (PRD §11, scoped to Trips — Itineraries are a
 * generated document derived from a trip, not a second countable record;
 * see docs/PHASE_13_2.md §1). Every trip created in the period —
 * `trips_select_internal` RLS (0013) already lets any signed-in user read
 * every trip, same transparency baseline as Vendors/Assets/Events.
 * `filters.departmentId`/`status` are not applicable to trips (a trip has
 * neither column) and are ignored, same as Attendance/Invitations ignore
 * whichever of the two generic `ReportFilters` fields their own
 * definition has no use for.
 */
export async function runLogisticsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const trips = await listTrips(client, { createdFrom: from, createdTo: to });

  return {
    reportKey: "logistics",
    title: "Logistics Report",
    period: { from, to },
    columns: [
      { key: "destination", label: "Destination" },
      { key: "departureAt", label: "Departure" },
      { key: "arrivalAt", label: "Arrival" },
      { key: "estimatedCost", label: "Estimated cost", align: "right" },
      { key: "actualCost", label: "Actual cost", align: "right" },
      { key: "currency", label: "Currency" },
      { key: "createdAt", label: "Created" },
    ],
    rows: trips.map((t) => ({
      destination: t.destination ?? "—",
      departureAt: t.departureAt ?? "—",
      arrivalAt: t.arrivalAt ?? "—",
      estimatedCost: t.estimatedCost,
      actualCost: t.actualCost,
      currency: t.currency,
      createdAt: t.createdAt.slice(0, 10),
    })),
  };
}
