import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listContributionsInPeriod } from "../../contributions/list";
import type { ContributionStatus } from "../../contributions/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Contribution Report" (PRD §11). Every contribution recorded in the
 * period, across every campaign/member — `listContributionsInPeriod`
 * (new this phase, see docs/PHASE_13_2.md §1) composes the exact same
 * `contribution_records_select_scoped` RLS (0014) `listContributionsForCampaign`/
 * `listContributionsForMember` already rely on, so a plain member running
 * this report sees only their own contributions (exactly what the
 * Contributions page's "My contributions" section already shows them),
 * and a `finance.contributions.manage`/`.read` holder sees every
 * contributor's. `filters.status` narrows by `ContributionStatus`
 * (pending/confirmed/reversed).
 */
export async function runContributionsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const contributions = await listContributionsInPeriod(client, {
    contributedFrom: from,
    contributedTo: to,
    status: filters.status as ContributionStatus | undefined,
  });

  return {
    reportKey: "contributions",
    title: "Contribution Report",
    period: { from, to },
    columns: [
      { key: "campaignName", label: "Campaign" },
      { key: "memberName", label: "Member" },
      { key: "amount", label: "Amount", align: "right" },
      { key: "currency", label: "Currency" },
      { key: "status", label: "Status" },
      { key: "contributedAt", label: "Contributed" },
    ],
    rows: contributions.map((c) => ({
      campaignName: c.campaignName,
      memberName: c.memberName,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      contributedAt: c.contributedAt.slice(0, 10),
    })),
  };
}
