import type { Database } from "@ngc/db";
import type { CampaignStatus, CampaignSummary, ContributionCampaign, ContributionRecord, ContributionStatus } from "./types";

type CampaignRow = Database["public"]["Tables"]["contribution_campaigns"]["Row"];
type RecordRow = Database["public"]["Tables"]["contribution_records"]["Row"];
type SummaryRow = Database["public"]["Views"]["contribution_campaign_summary"]["Row"];

export function mapCampaignRow(row: CampaignRow): ContributionCampaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetAmount: row.target_amount,
    currency: row.currency,
    deadline: row.deadline,
    status: row.status as CampaignStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapContributionRow(row: RecordRow): ContributionRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    memberId: row.member_id,
    amount: row.amount,
    currency: row.currency,
    contributedAt: row.contributed_at,
    paymentMethod: row.payment_method,
    reference: row.reference,
    status: row.status as ContributionStatus,
    notes: row.notes,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

/**
 * `contribution_campaign_summary` (0014) is the exact PRD §7.14 "campaign
 * dashboard" (contributors, totals, outstanding, achievement %) — this
 * mapper reads the view, it never recomputes the aggregate client-side.
 */
export function mapCampaignSummaryRow(row: SummaryRow): CampaignSummary {
  return {
    campaignId: row.campaign_id ?? "",
    name: row.name ?? "",
    targetAmount: row.target_amount,
    totalContributors: row.total_contributors ?? 0,
    totalContributed: row.total_contributed ?? 0,
    outstandingAmount: row.outstanding_amount ?? 0,
    achievementPercentage: row.achievement_percentage,
  };
}
