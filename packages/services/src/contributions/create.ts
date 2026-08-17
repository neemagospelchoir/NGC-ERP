import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapCampaignRow } from "./map";
import type { ContributionCampaign, CreateCampaignInput } from "./types";

/**
 * Defaults `status` to `"active"`, not `"draft"` — matching this table's
 * own column default (0014) and the demo seed's own usage
 * (`002_demo_data.sql`'s `DEMO_Grace Unlimited Event`, created directly as
 * `active`). A Finance Manager who wants to prepare a campaign before
 * announcing it can still pass `status: "draft"` explicitly and activate it
 * later via `setCampaignStatus`.
 */
export async function createCampaign(
  client: SupabaseClient<Database>,
  input: CreateCampaignInput
): Promise<ContributionCampaign> {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Campaign name is required.");
  if (input.targetAmount !== undefined && input.targetAmount !== null && input.targetAmount < 0) {
    throw new ServiceError("Target amount cannot be negative.");
  }

  const { data, error } = await client
    .from("contribution_campaigns")
    .insert({
      name,
      description: input.description ?? null,
      target_amount: input.targetAmount ?? null,
      currency: input.currency?.trim() || "TZS",
      deadline: input.deadline ?? null,
      status: input.status ?? "active",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not create the contribution campaign.", error);
  return mapCampaignRow(data);
}
