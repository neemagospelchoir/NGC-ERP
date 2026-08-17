import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, contributions } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatTile, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { recordContributionAction, reverseContributionAction, setCampaignStatusAction, updateCampaignAction } from "../actions";
import { CampaignForm } from "../campaign-form";
import { ContributionRecordsTable } from "../contribution-records-table";
import { RecordContributionForm } from "../contribution-form";

export const metadata: Metadata = { title: "Campaign — NGC ERP" };

const MANAGE_PERMISSION = "finance.contributions.manage";
const READ_PERMISSION = "finance.contributions.read";

const STATUS_TONE = { draft: "neutral", active: "good", closed: "neutral", cancelled: "critical" } as const;

/** Mirrors `setCampaignStatus`'s own state machine (packages/services/src/contributions/update.ts) — the page never offers a transition the service layer would reject. */
const NEXT_STATUSES: Record<contributions.CampaignStatus, contributions.CampaignStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * The campaign dashboard named in PRD §7.14 — reads
 * `contribution_campaign_summary` (0014) directly, never recomputing totals
 * client-side. The full contribution-records list below is shown to anyone
 * holding `finance.contributions.manage` OR `finance.contributions.read`
 * (Phase 9.1's HR grant — see docs/PHASE_9_1.md §2.3/§4) — matching
 * `contribution_records_select_scoped` RLS exactly, which grants full-table
 * read to either permission, not just `.manage`. Recording a contribution
 * and changing campaign status stay gated on `.manage` alone, since the
 * write policy (`contribution_records_write_finance`/`contribution_
 * campaigns_write_finance`) recognizes only that permission.
 */
export default async function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const canReadAllRecords = canManage || Boolean(currentUser?.permissionCodes.includes(READ_PERMISSION));

  const campaign = await contributions.getCampaign(supabase, params.id);
  if (!campaign) notFound();

  const [summary, records] = await Promise.all([
    contributions.getCampaignSummary(supabase, campaign.id),
    canReadAllRecords ? contributions.listContributionsForCampaign(supabase, campaign.id) : Promise.resolve([]),
  ]);

  const boundUpdate = updateCampaignAction.bind(null, campaign.id);
  const boundRecord = recordContributionAction.bind(null, campaign.id);
  const reverseActions = canManage
    ? Object.fromEntries(records.map((r) => [r.id, reverseContributionAction.bind(null, campaign.id, r.id)]))
    : undefined;
  const nextStatuses = NEXT_STATUSES[campaign.status];
  // A closed/cancelled campaign is permanent — `updateCampaign`/
  // `recordContribution` both now refuse server-side (see their own doc
  // comments), and the page mirrors that here rather than showing a form
  // whose submission would just come back as an error.
  const isTerminal = campaign.status === "closed" || campaign.status === "cancelled";

  return (
    <>
      <PageHeader
        title={campaign.name}
        breadcrumb={["NGC ERP", "Contributions"]}
        action={<StatusPill tone={STATUS_TONE[campaign.status]} label={labelize(campaign.status)} />}
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Target" value={formatAmount(summary.targetAmount, campaign.currency)} />
          <StatTile label="Total contributed" value={formatAmount(summary.totalContributed, campaign.currency)} />
          <StatTile label="Outstanding" value={formatAmount(summary.outstandingAmount, campaign.currency)} />
          <StatTile
            label="Achievement"
            value={summary.achievementPercentage === null ? "—" : `${summary.achievementPercentage}%`}
            helperText={`${summary.totalContributors} contributor${summary.totalContributors === 1 ? "" : "s"}`}
          />
        </div>
      )}

      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            {canManage && !isTerminal ? (
              <CampaignForm action={boundUpdate} initial={campaign} submitLabel="Save changes" pendingLabel="Saving…" />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Target</dt>
                  <dd className="text-sm text-ink-primary">{formatAmount(campaign.targetAmount, campaign.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Description</dt>
                  <dd className="text-sm text-ink-primary">{campaign.description ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Deadline</dt>
                  <dd className="text-sm text-ink-primary">{campaign.deadline ? new Date(campaign.deadline).toLocaleDateString() : "—"}</dd>
                </div>
                {isTerminal && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Editing</dt>
                    <dd className="text-sm text-ink-primary">A {labelize(campaign.status)} campaign can no longer be edited.</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {canReadAllRecords && (
            <Card>
              <CardHeader>
                <CardTitle>Contribution records</CardTitle>
              </CardHeader>
              <ContributionRecordsTable rows={records} reverseActions={reverseActions} />
            </Card>
          )}
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            {!isTerminal && (
              <Card>
                <CardHeader>
                  <CardTitle>Record a contribution</CardTitle>
                </CardHeader>
                <RecordContributionForm action={boundRecord} />
              </Card>
            )}

            {nextStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">A campaign moves forward only — closed and cancelled are permanent.</p>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((next) => {
                    const changeStatus = async () => {
                      "use server";
                      await setCampaignStatusAction(campaign.id, next);
                    };
                    return (
                      <form key={next} action={changeStatus}>
                        <Button type="submit" variant={next === "cancelled" ? "destructive" : "secondary"} size="sm">
                          Mark {labelize(next)}
                        </Button>
                      </form>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
