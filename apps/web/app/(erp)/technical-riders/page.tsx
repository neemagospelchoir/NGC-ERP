import type { Metadata } from "next";
import { auth, technicalRiders } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createTechnicalRiderAction } from "./actions";
import { TechnicalRiderForm } from "./rider-form";
import { TechnicalRidersTable } from "./technical-riders-table";

export const metadata: Metadata = { title: "Technical Riders — NGC ERP" };

const MANAGE_PERMISSION = "technical.riders.manage";

/**
 * Always visible, unlike Vendors/Assets/Gate Passes — `technical_riders_
 * select_internal` RLS (0009) lets ANY signed-in user read every rider
 * (there is no event-participant scoping here at all, unlike Playlists),
 * matching PRD §6's Permission Matrix row giving most roles a plain "Read"
 * entitlement on Technical Rider/Playlist. Only creating/editing a rider is
 * gated on `technical.riders.manage`, matching `technical_riders_write_
 * technical` RLS exactly.
 */
export default async function TechnicalRidersPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await technicalRiders.listTechnicalRiders(supabase);

  return (
    <>
      <PageHeader title="Technical Riders" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <TechnicalRidersTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Create a technical rider</CardTitle>
            </CardHeader>
            <TechnicalRiderForm
              action={createTechnicalRiderAction}
              showEventIdField
              submitLabel="Create technical rider"
              pendingLabel="Creating…"
            />
          </Card>
        )}
      </div>
    </>
  );
}
