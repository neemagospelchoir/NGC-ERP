import type { Metadata } from "next";
import { auth, gatePasses } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createGatePassAction } from "./actions";
import { GatePassForm } from "./gate-pass-form";
import { GatePassTable } from "./gate-pass-table";

export const metadata: Metadata = { title: "Gate Passes — NGC ERP" };

const READ_PERMISSIONS = ["inventory.gate_passes.manage", "inventory.gate_passes.read"];
const MANAGE_PERMISSION = "inventory.gate_passes.manage";

/**
 * `gate_passes_select_internal` RLS (0011) lets any signed-in user read
 * this table — gated here on `inventory.gate_passes.manage`/`.read`
 * (Technical Manager, Inventory Officer, Secretary per the seed) as a UI
 * convenience matching Vendors/Assets' nav treatment (docs/PHASE_8_1.md),
 * not the access boundary itself. Creating a gate pass (and therefore
 * triggering the underlying equipment assignment, add-item.ts) is gated on
 * `inventory.gate_passes.manage` specifically, matching PRD §6's "Technical
 * Manager: Create, Approve (tier 1)".
 */
export default async function GatePassesPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Gate Passes" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view gate passes.</p>
        </Card>
      </>
    );
  }

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const rows = await gatePasses.listGatePasses(supabase);

  return (
    <>
      <PageHeader title="Gate Passes" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <GatePassTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Create a gate pass</CardTitle>
            </CardHeader>
            <GatePassForm action={createGatePassAction} defaultPersonResponsibleId={currentUser?.id} />
          </Card>
        )}
      </div>
    </>
  );
}
