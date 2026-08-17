import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapCampaignRow, mapCampaignSummaryRow, mapContributionRow } from "./map";
import type { CampaignSummary, ContributionCampaign, ContributionRecord, ContributionStatus } from "./types";

export interface ListCampaignsOptions {
  /** Inclusive `deadline` range — added for Phase 10.3's Calendar aggregation. Campaigns with a null deadline are always excluded when either bound is set, since they have nothing to place on a calendar. */
  deadlineFrom?: string;
  deadlineTo?: string;
}

export async function listCampaigns(client: SupabaseClient<Database>, options: ListCampaignsOptions = {}): Promise<ContributionCampaign[]> {
  let query = client.from("contribution_campaigns").select("*").order("created_at", { ascending: false });
  if (options.deadlineFrom) query = query.gte("deadline", options.deadlineFrom);
  if (options.deadlineTo) query = query.lte("deadline", options.deadlineTo);
  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load contribution campaigns.", error);
  return (data ?? []).map(mapCampaignRow);
}

export async function getCampaign(client: SupabaseClient<Database>, id: string): Promise<ContributionCampaign | null> {
  const { data, error } = await client.from("contribution_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the contribution campaign.", error);
  return data ? mapCampaignRow(data) : null;
}

/**
 * Reads `contribution_campaign_summary` (0014) directly — the aggregate is
 * computed once, in SQL, and this never recomputes it client-side. Returns
 * `null` if the campaign has no matching summary row (should not happen in
 * practice, since the view's `left join` always produces one row per
 * campaign, but `.maybeSingle()` is used defensively rather than assuming).
 */
export async function getCampaignSummary(client: SupabaseClient<Database>, campaignId: string): Promise<CampaignSummary | null> {
  const { data, error } = await client
    .from("contribution_campaign_summary")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw new ServiceError("Could not load the campaign summary.", error);
  return data ? mapCampaignSummaryRow(data) : null;
}

export async function listContributionsForCampaign(
  client: SupabaseClient<Database>,
  campaignId: string
): Promise<ContributionRecord[]> {
  const { data, error } = await client
    .from("contribution_records")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("contributed_at", { ascending: false });
  if (error) throw new ServiceError("Could not load contributions.", error);
  return (data ?? []).map(mapContributionRow);
}

/**
 * `contribution_records_select_scoped` RLS (0014) already lets a member
 * read their own rows regardless of permission — this is the explicit,
 * application-level equivalent (the same "belt and suspenders" reasoning
 * as `listAssignmentsForMember`/`listPlaylistsForParticipant`, Phase 8.2/
 * 8.4), used by the "My contributions" section of the Contributions page.
 */
export async function listContributionsForMember(
  client: SupabaseClient<Database>,
  memberId: string
): Promise<ContributionRecord[]> {
  const { data, error } = await client
    .from("contribution_records")
    .select("*")
    .eq("member_id", memberId)
    .order("contributed_at", { ascending: false });
  if (error) throw new ServiceError("Could not load your contributions.", error);
  return (data ?? []).map(mapContributionRow);
}

export interface ListContributionsOptions {
  /** Inclusive `contributed_at` range — added for Phase 13.2's Contribution Report, the same shape as every other report definition's period filter. */
  contributedFrom?: string;
  contributedTo?: string;
  status?: ContributionStatus;
}

export interface ContributionRecordWithNames extends ContributionRecord {
  memberName: string;
  campaignName: string;
}

/**
 * Every contribution across every campaign/member within a period, not
 * scoped to one campaign or one member the way `listContributionsForCampaign`/
 * `listContributionsForMember` are — used by the Contribution Report
 * (Phase 13.2). Deliberately issues no new RLS: `contribution_records_
 * select_scoped` (0014) already governs this exactly as it governs those
 * two narrower functions, so a plain member calling this sees only their
 * own rows, and a `finance.contributions.manage`/`.read` holder sees
 * every row — the report's own filter widens nothing.
 */
export async function listContributionsInPeriod(
  client: SupabaseClient<Database>,
  options: ListContributionsOptions = {}
): Promise<ContributionRecordWithNames[]> {
  let query = client.from("contribution_records").select("*").order("contributed_at", { ascending: false });
  if (options.contributedFrom) query = query.gte("contributed_at", options.contributedFrom);
  if (options.contributedTo) query = query.lte("contributed_at", options.contributedTo);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load contributions.", error);
  const rows = (data ?? []).map(mapContributionRow);
  if (rows.length === 0) return [];

  const [memberNamesById, campaignNamesById] = await Promise.all([
    resolveMemberNames(client, rows.map((r) => r.memberId)),
    resolveCampaignNames(client, rows.map((r) => r.campaignId)),
  ]);

  return rows.map((row) => ({
    ...row,
    memberName: memberNamesById.get(row.memberId) ?? "Unknown member",
    campaignName: campaignNamesById.get(row.campaignId) ?? "Unknown campaign",
  }));
}

async function resolveMemberNames(client: SupabaseClient<Database>, memberIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(memberIds)];
  const namesById = new Map<string, string>();
  if (ids.length === 0) return namesById;
  const { data, error } = await client.from("members").select("id, first_name, last_name").in("id", ids);
  if (error) throw new ServiceError("Could not resolve member names.", error);
  for (const m of data ?? []) namesById.set(m.id, `${m.first_name} ${m.last_name}`);
  return namesById;
}

async function resolveCampaignNames(client: SupabaseClient<Database>, campaignIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(campaignIds)];
  const namesById = new Map<string, string>();
  if (ids.length === 0) return namesById;
  const { data, error } = await client.from("contribution_campaigns").select("id, name").in("id", ids);
  if (error) throw new ServiceError("Could not resolve campaign names.", error);
  for (const c of data ?? []) namesById.set(c.id, c.name);
  return namesById;
}
