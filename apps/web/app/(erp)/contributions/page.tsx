import type { Metadata } from "next";
import { auth, contributions } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createCampaignAction } from "./actions";
import { CampaignForm } from "./campaign-form";
import { CampaignsTable } from "./campaigns-table";

export const metadata: Metadata = { title: "Contributions — NGC ERP" };

const MANAGE_PERMISSION = "finance.contributions.manage";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * Always visible, same "everyone has a real reason to be here" shape as
 * Uniforms/Technical Riders/Trips — `contribution_campaigns_select_internal`
 * RLS (0014) lets any signed-in user read every campaign outright, and
 * `contribution_records_select_scoped` legitimately lets every member see
 * their OWN contribution history (self-row clause, no permission needed) —
 * exactly like Uniforms' "My uniform issues" section. Only campaign
 * creation/editing/status changes and recording a contribution on someone
 * ELSE's behalf are gated on `finance.contributions.manage`, matching
 * `contribution_campaigns_write_finance`/`contribution_records_write_finance`
 * RLS, which — like Uniforms — grants no department-leader write allowance.
 *
 * PRD §6's Permission Matrix names Department Leader as "Read (own dept.
 * summary)" — NOT satisfiable today since `contribution_records` carries no
 * department scoping at all (only own-row-or-permission); this is a genuine
 * RLS limitation, not something this page papers over with an app-layer
 * filter that RLS doesn't actually back (see docs/PHASE_9_1.md §7 for the
 * open item, and Trips/Phase 8.5's identical reasoning for NOT building a
 * cosmetic-only filter).
 */
export default async function ContributionsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [rows, myContributions] = await Promise.all([
    contributions.listCampaigns(supabase),
    currentUser?.member ? contributions.listContributionsForMember(supabase, currentUser.member.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Contributions" breadcrumb={["NGC ERP"]} />

      {currentUser?.member && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My contributions</CardTitle>
          </CardHeader>
          {myContributions.length === 0 ? (
            <p className="text-sm text-ink-secondary">You have no recorded contributions yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {myContributions.map((c) => (
                <li key={c.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink-primary">
                    {formatAmount(c.amount, c.currency)} — {c.status}
                  </p>
                  <p className="text-xs text-ink-muted">{new Date(c.contributedAt).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <CampaignsTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Start a campaign</CardTitle>
            </CardHeader>
            <CampaignForm action={createCampaignAction} submitLabel="Create campaign" pendingLabel="Creating…" />
          </Card>
        )}
      </div>
    </>
  );
}
