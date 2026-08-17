import type { Metadata } from "next";
import { auth, trips } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createTripAction } from "./actions";
import { TripForm } from "./trip-form";
import { TripsTable } from "./trips-table";

export const metadata: Metadata = { title: "Trips — NGC ERP" };

const MANAGE_PERMISSION = "logistics.trips.manage";

/**
 * Always visible, like Technical Riders — `trips_select_internal`/
 * `itineraries_select_internal` RLS (0013) lets ANY signed-in user read
 * every trip and itinerary outright, with no narrower scoping at all. This
 * is actually BROADER than PRD §6's Permission Matrix intends for a plain
 * Choir Member ("Read (assigned trip)" — their own trip only), but since
 * that narrowing isn't something RLS enforces today, adding an app-layer
 * filter here would be misleading (anyone with a valid session could still
 * read every row directly via the REST API) rather than real
 * defense-in-depth — unlike Playlists' `listPlaylistsForParticipant`, which
 * reinforces a boundary RLS already draws. Flagged as an open gap in
 * docs/PHASE_8_5.md §7, not silently worked around at the application layer.
 * Only creating/editing trips and itineraries is gated on
 * `logistics.trips.manage`.
 */
export default async function TripsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await trips.listTrips(supabase);

  return (
    <>
      <PageHeader title="Trips" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <TripsTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Create a trip</CardTitle>
            </CardHeader>
            <TripForm action={createTripAction} showEventIdField submitLabel="Create trip" pendingLabel="Creating…" />
          </Card>
        )}
      </div>
    </>
  );
}
