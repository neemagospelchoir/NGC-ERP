import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAssetRow } from "./map";
import type { Asset, AssetCondition, UpdateAssetInput } from "./types";

export async function updateAsset(client: SupabaseClient<Database>, id: string, input: UpdateAssetInput): Promise<Asset> {
  const patch: Database["public"]["Tables"]["assets"]["Update"] = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError("Asset name cannot be empty.");
    patch.name = trimmed;
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.serialNumber !== undefined) patch.serial_number = input.serialNumber;
  if (input.purchaseDate !== undefined) patch.purchase_date = input.purchaseDate;
  if (input.purchaseValue !== undefined) patch.purchase_value = input.purchaseValue;
  if (input.currentValue !== undefined) patch.current_value = input.currentValue;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.condition !== undefined) patch.condition = input.condition;
  if (input.location !== undefined) patch.location = input.location;
  if (input.custodianUserId !== undefined) patch.custodian_user_id = input.custodianUserId;
  if (input.owningDepartmentId !== undefined) patch.owning_department_id = input.owningDepartmentId;
  if (input.photoUrls !== undefined) patch.photo_urls = input.photoUrls;

  const { data, error } = await client.from("assets").update(patch).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the asset.", error);
  return mapAssetRow(data);
}

export async function setAssetCondition(client: SupabaseClient<Database>, id: string, condition: AssetCondition): Promise<Asset> {
  const { data, error } = await client.from("assets").update({ condition }).eq("id", id).select("*").single();
  if (error) throw new ServiceError("Could not update the asset's condition.", error);
  return mapAssetRow(data);
}

/**
 * Disposal never deletes the row (0010's own table comment: "preserving
 * assignment/return/damage history permanently"). Sets `condition` AND
 * `availability_status` to `disposed`, records `disposed_at`/
 * `disposal_reason`, and leaves every past `asset_assignments` row intact.
 */
export async function disposeAsset(client: SupabaseClient<Database>, id: string, reason: string): Promise<Asset> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new ServiceError("A disposal reason is required.");

  const { data, error } = await client
    .from("assets")
    .update({
      condition: "disposed",
      availability_status: "disposed",
      disposed_at: new Date().toISOString(),
      disposal_reason: trimmedReason,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not dispose of the asset.", error);
  return mapAssetRow(data);
}
