import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapContributionRow } from "./map";
import type { ContributionRecord, RecordContributionInput } from "./types";

/**
 * Defaults `status` to `"confirmed"` — matching the table's own column
 * default (0014) and the demo seed's usage. A caller recording a
 * not-yet-cleared payment (e.g. a mobile money transaction awaiting
 * confirmation) can still record it and correct the status afterward via
 * `reverseContribution` — there is no separate "confirm a pending
 * contribution" action this phase, since PRD §7.14 does not describe one
 * distinct from simply recording it as confirmed once cleared.
 */
export async function recordContribution(
  client: SupabaseClient<Database>,
  input: RecordContributionInput
): Promise<ContributionRecord> {
  if (!input.campaignId) throw new ServiceError("A campaign is required.");
  if (!input.memberId) throw new ServiceError("A member is required.");
  if (!(input.amount >= 0)) throw new ServiceError("Amount must be zero or a positive number.");

  // An adversarial security review of this phase found that neither this
  // function nor `contribution_records_write_finance` RLS (0014, which
  // checks only the caller's permission, never the parent campaign's
  // status) stopped a new contribution from being recorded against a
  // campaign that had already been closed or cancelled — silently moving
  // a "permanent" campaign's totals after the fact. This re-reads the
  // parent campaign's status and refuses anything but `active` (a `draft`
  // campaign isn't open for contributions yet either, matching the
  // "campaign dashboard" only being meaningful once a campaign is live).
  const { data: campaign, error: campaignError } = await client
    .from("contribution_campaigns")
    .select("status")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (campaignError) throw new ServiceError("Could not load the campaign.", campaignError);
  if (!campaign) throw new ServiceError("Campaign not found.");
  if (campaign.status !== "active") {
    throw new ServiceError(`Contributions cannot be recorded against a "${campaign.status}" campaign.`);
  }

  const { data, error } = await client
    .from("contribution_records")
    .insert({
      campaign_id: input.campaignId,
      member_id: input.memberId,
      amount: input.amount,
      currency: input.currency?.trim() || "TZS",
      contributed_at: input.contributedAt ?? undefined,
      payment_method: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      status: "confirmed",
      notes: input.notes ?? null,
      recorded_by: input.recordedBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not record the contribution.", error);
  return mapContributionRow(data);
}

/**
 * Reverses a contribution (e.g. a bounced/duplicate/mistaken entry) by
 * marking it `"reversed"` rather than deleting the row — matching this
 * codebase's established "never delete a financial/audit-relevant record"
 * convention (Discipline's own "never deleted" principle, spec S33, and
 * Assets' disposal-not-deletion pattern, docs/PHASE_8_1.md). `total_
 * contributed` in `contribution_campaign_summary` already excludes
 * non-`confirmed` rows (`filter (where r.status = 'confirmed')`, 0014), so
 * a reversed contribution stops counting toward the campaign total the
 * moment this runs, with no separate recalculation step needed.
 */
export async function reverseContribution(client: SupabaseClient<Database>, id: string): Promise<ContributionRecord> {
  const { data: existing, error: existingError } = await client
    .from("contribution_records")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not load the contribution.", existingError);
  if (!existing) throw new ServiceError("Contribution not found.");
  if (existing.status === "reversed") throw new ServiceError("This contribution has already been reversed.");

  const { data, error } = await client
    .from("contribution_records")
    .update({ status: "reversed" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not reverse the contribution.", error);
  return mapContributionRow(data);
}
