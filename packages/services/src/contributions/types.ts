export type CampaignStatus = "draft" | "active" | "closed" | "cancelled";
export type ContributionStatus = "pending" | "confirmed" | "reversed";

export interface ContributionCampaign {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number | null;
  currency: string;
  deadline: string | null;
  status: CampaignStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSummary {
  campaignId: string;
  name: string;
  targetAmount: number | null;
  totalContributors: number;
  totalContributed: number;
  outstandingAmount: number;
  achievementPercentage: number | null;
}

export interface ContributionRecord {
  id: string;
  campaignId: string;
  memberId: string;
  amount: number;
  currency: string;
  contributedAt: string;
  paymentMethod: string | null;
  reference: string | null;
  status: ContributionStatus;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  targetAmount?: number | null;
  currency?: string;
  deadline?: string | null;
  status?: CampaignStatus;
  createdBy?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  targetAmount?: number | null;
  currency?: string;
  deadline?: string | null;
}

export interface RecordContributionInput {
  campaignId: string;
  memberId: string;
  amount: number;
  currency?: string;
  contributedAt?: string;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
}
