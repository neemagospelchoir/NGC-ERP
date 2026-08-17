import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createAsset } from "../inventory/create";
import type { Asset, CreateAssetInput } from "../inventory/types";
import { ServiceError } from "../shared/errors";
import { mapPurchaseOrderRow } from "./map";
import type { PurchaseOrder } from "./types";

/**
 * PRD §7.17's "Inventory update" step — when a purchase turns out to be an
 * asset (not a consumable/one-off expense), this creates the new
 * `assets` row via Phase 8.1's OWN `inventory.createAsset` directly rather
 * than re-implementing asset creation here, then links it back via
 * `purchase_orders.created_asset_id` — the same reuse-not-reimplement
 * pattern Gate Pass (8.3) established for `inventory.assignAsset`. Left
 * entirely manual (a Finance/Procurement user explicitly triggers this
 * once, for purchases that are actually assets) rather than
 * auto-detecting "is this an asset" from the purchase description — PRD
 * §7.17 says "automatically create OR SUGGEST an inventory record,"
 * and this phase treats "explicitly triggered by the person who just
 * recorded the purchase" as satisfying "suggest" without inventing
 * category-guessing heuristics no other module in this codebase has.
 *
 * Refuses to run twice for the same purchase order (a purchase order maps
 * to at most one created asset, matching `purchase_orders.created_asset_id`
 * being a single nullable FK, not a list).
 */
export async function createAssetForPurchaseOrder(
  client: SupabaseClient<Database>,
  purchaseOrderId: string,
  assetInput: CreateAssetInput
): Promise<{ purchaseOrder: PurchaseOrder; asset: Asset }> {
  const { data: current, error: loadError } = await client
    .from("purchase_orders")
    .select("created_asset_id")
    .eq("id", purchaseOrderId)
    .maybeSingle();
  if (loadError) throw new ServiceError("Could not load the purchase order.", loadError);
  if (!current) throw new ServiceError("Purchase order not found.");
  if (current.created_asset_id) throw new ServiceError("An inventory record has already been created for this purchase order.");

  const asset = await createAsset(client, assetInput);

  const { data, error } = await client
    .from("purchase_orders")
    .update({ created_asset_id: asset.id })
    .eq("id", purchaseOrderId)
    .select("*")
    .single();
  if (error) {
    throw new ServiceError(
      "The asset was created, but the purchase order could not be linked to it. Please contact an administrator.",
      error
    );
  }

  return { purchaseOrder: mapPurchaseOrderRow(data), asset };
}
