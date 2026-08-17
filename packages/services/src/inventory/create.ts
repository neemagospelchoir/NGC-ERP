import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAssetRow } from "./map";
import type { Asset, CreateAssetInput } from "./types";

const ASSET_TAG_SEQUENCE_KEY = "asset_tag";
const ASSET_TAG_SETTING_KEY = "id_format.asset_tag";
/** Only used if system_settings is somehow missing the row every seed applies — see createMember's identical fallback rationale. */
const FALLBACK_ASSET_TAG_FORMAT = "AST-{year}-{sequence}";

/**
 * Creates an asset. Mirrors `createMember`/`submitInvitation`'s
 * organization-configurable ID generation exactly: reads
 * `system_settings.id_format.asset_tag` and passes it to the shared
 * `next_formatted_id()` Postgres function rather than inventing a format
 * here (spec: no organization-specific ID format hardcoded).
 */
export async function createAsset(client: SupabaseClient<Database>, input: CreateAssetInput): Promise<Asset> {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Asset name is required.");
  if (!input.categoryId) throw new ServiceError("An asset category is required.");

  const { data: formatSetting, error: formatError } = await client
    .from("system_settings")
    .select("value")
    .eq("setting_key", ASSET_TAG_SETTING_KEY)
    .maybeSingle();
  if (formatError) throw new ServiceError("Could not resolve the asset tag format.", formatError);
  const format = typeof formatSetting?.value === "string" ? formatSetting.value : FALLBACK_ASSET_TAG_FORMAT;

  const { data: assetTag, error: rpcError } = await client.rpc("next_formatted_id", {
    p_sequence_key: ASSET_TAG_SEQUENCE_KEY,
    p_format: format,
  });
  if (rpcError || !assetTag) throw new ServiceError("Could not generate an asset tag.", rpcError);

  const { data, error } = await client
    .from("assets")
    .insert({
      asset_tag: assetTag,
      category_id: input.categoryId,
      name,
      serial_number: input.serialNumber ?? null,
      purchase_date: input.purchaseDate ?? null,
      purchase_value: input.purchaseValue ?? null,
      current_value: input.currentValue ?? null,
      currency: input.currency ?? "TZS",
      condition: input.condition ?? "good",
      availability_status: "available",
      location: input.location ?? null,
      custodian_user_id: input.custodianUserId ?? null,
      owning_department_id: input.owningDepartmentId ?? null,
      photo_urls: input.photoUrls ?? [],
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not create the asset.", error);
  return mapAssetRow(data);
}
