import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapCampaignRow } from "./map";
import type { CampaignStatus, ContributionCampaign, UpdateCampaignInput } from "./types";

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

/**
 * An adversarial security review of this phase found that a campaign's
 * name/target/deadline could still be edited after it reached a terminal
 * `closed`/`cancelled` status — contradicting the UI's own "closed and
 * cancelled are permanent" claim and letting a closed campaign's
 * `target_amount` be edited retroactively, changing what its
 * already-final "achievement %" would have looked like. This re-reads the
 * campaign's current status and refuses to edit a terminal one, matching
 * `setCampaignStatus`'s own re-read-don't-trust-the-caller fix above.
 */
export async function updateCampaign(
  client: SupabaseClient<Database>,
  id: string,
  input: UpdateCampaignInput
): Promise<ContributionCampaign> {
  const { data: current, error: loadError } = await client.from("contribution_campaigns").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the campaign.", loadError);
  if (!current) throw new ServiceError("Campaign not found.");
  if (current.status === "closed" || current.status === "cancelled") {
    throw new ServiceError(`A "${current.status}" campaign can no longer be edited.`);
  }

  const fields: Database["public"]["Tables"]["contribution_campaigns"]["Update"] = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ServiceError("Campaign name cannot be blank.");
    fields.name = name;
  }
  if (input.description !== undefined) fields.description = input.description;
  if (input.targetAmount !== undefined) {
    if (input.targetAmount !== null && input.targetAmount < 0) throw new ServiceError("Target amount cannot be negative.");
    fields.target_amount = input.targetAmount;
  }
  if (input.currency !== undefined) {
    const currency = input.currency.trim();
    if (!currency) throw new ServiceError("Currency cannot be blank.");
    fields.currency = currency;
  }
  if (input.deadline !== undefined) fields.deadline = input.deadline;

  if (Object.keys(fields).length === 0) throw new ServiceError("Nothing to update.");

  const { data, error } = await client.from("contribution_campaigns").update(fields).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the campaign.", error);
  return mapCampaignRow(data);
}

/**
 * A small, explicit state machine (`draft -> active -> closed`, either
 * non-terminal state -> `cancelled`) rather than accepting any status
 * string — mirrors `setVendorStatus`'s shape (Phase 8.1) applied to this
 * table's own four-value `check` constraint (0014).
 *
 * Unlike an earlier version of this function, the current status is
 * re-read from the database HERE, not accepted as a caller-supplied
 * parameter — an adversarial security review of this phase found that
 * trusting a caller-supplied `currentStatus` (sourced from a page's
 * render-time snapshot) let a stale browser tab, or a direct call to
 * `setCampaignStatusAction` with a forged `from` value, silently revert a
 * campaign that was actually already `closed`/`cancelled` back to
 * `active` — defeating the "closed and cancelled are permanent" invariant
 * the UI claims to enforce. This now matches Discipline's own
 * `advanceCaseStatus` (packages/services/src/discipline/case-status.ts),
 * which re-reads the authoritative row's status before validating a
 * transition, rather than trusting what the caller claims it currently is.
 */
export async function setCampaignStatus(
  client: SupabaseClient<Database>,
  id: string,
  nextStatus: CampaignStatus
): Promise<ContributionCampaign> {
  const { data: current, error: loadError } = await client.from("contribution_campaigns").select("status").eq("id", id).maybeSingle();
  if (loadError) throw new ServiceError("Could not load the campaign.", loadError);
  if (!current) throw new ServiceError("Campaign not found.");

  const currentStatus = current.status as CampaignStatus;
  if (!VALID_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new ServiceError(`A campaign cannot move from "${currentStatus}" to "${nextStatus}".`);
  }
  const { data, error } = await client
    .from("contribution_campaigns")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not update the campaign's status.", error);
  return mapCampaignRow(data);
}
