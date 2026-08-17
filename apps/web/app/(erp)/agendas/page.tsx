import type { Metadata } from "next";
import { agendas, auth } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createAgendaAction } from "./actions";
import { AgendaForm } from "./agenda-form";
import { AgendasTable } from "./agendas-table";

export const metadata: Metadata = { title: "Agenda & Voting — NGC ERP" };

const MANAGE_PERMISSION = "management.agenda.manage";

/**
 * Always visible, the same "everyone has a real reason to be here" shape
 * as Announcements/Notifications/Calendar — `agendas_select_authenticated`
 * RLS (0017) lets any signed-in user read every agenda item outright (the
 * agenda ROW, not the individual ballots behind it — see docs/PHASE_10_4.md
 * §2 for the distinction). Creating/editing an agenda item is gated on
 * `management.agenda.manage`, matching `agendas_write_management` RLS.
 */
export default async function AgendasPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await agendas.listAgendas(supabase);

  return (
    <>
      <PageHeader title="Agenda & Voting" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <AgendasTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>New agenda item</CardTitle>
            </CardHeader>
            <AgendaForm action={createAgendaAction} submitLabel="Create agenda item" pendingLabel="Creating…" />
          </Card>
        )}
      </div>
    </>
  );
}
