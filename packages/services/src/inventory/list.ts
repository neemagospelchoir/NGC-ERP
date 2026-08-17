import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAssetAssignmentRow, mapAssetCategoryRow, mapAssetRow } from "./map";
import type {
  Asset,
  AssetAssignment,
  AssetAssignmentTargetType,
  AssetAvailabilityStatus,
  AssetCategory,
} from "./types";

export interface ListAssetCategoriesOptions {
  includeInactive?: boolean;
}

export async function listAssetCategories(
  client: SupabaseClient<Database>,
  options: ListAssetCategoriesOptions = {}
): Promise<AssetCategory[]> {
  let query = client.from("asset_categories").select("*").order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load asset categories.", error);
  return (data ?? []).map(mapAssetCategoryRow);
}

export interface ListAssetsOptions {
  categoryId?: string;
  availabilityStatus?: AssetAvailabilityStatus;
  /** Inclusive `created_at` range — added for Phase 13.2's Asset/Inventory Report, the same shape as every other report definition's period filter. */
  createdFrom?: string;
  createdTo?: string;
}

export async function listAssets(client: SupabaseClient<Database>, options: ListAssetsOptions = {}): Promise<Asset[]> {
  let query = client.from("assets").select("*").order("asset_tag", { ascending: true });
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.availabilityStatus) query = query.eq("availability_status", options.availabilityStatus);
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);

  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load assets.", error);
  return (data ?? []).map(mapAssetRow);
}

export async function getAsset(client: SupabaseClient<Database>, id: string): Promise<Asset | null> {
  const { data, error } = await client.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the asset.", error);
  return data ? mapAssetRow(data) : null;
}

export async function listAssetAssignments(client: SupabaseClient<Database>, assetId: string): Promise<AssetAssignment[]> {
  const { data, error } = await client
    .from("asset_assignments")
    .select("*")
    .eq("asset_id", assetId)
    .order("assigned_at", { ascending: false });
  if (error) throw new ServiceError("Could not load this asset's assignment history.", error);
  return (data ?? []).map(mapAssetAssignmentRow);
}

export async function listAssignmentsForTarget(
  client: SupabaseClient<Database>,
  targetType: AssetAssignmentTargetType,
  targetId: string
): Promise<AssetAssignment[]> {
  const { data, error } = await client
    .from("asset_assignments")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("assigned_at", { ascending: false });
  if (error) throw new ServiceError("Could not load assignments for this target.", error);
  return (data ?? []).map(mapAssetAssignmentRow);
}
