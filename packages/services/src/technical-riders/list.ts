import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapTechnicalRiderRow } from "./map";
import type { TechnicalRider } from "./types";

export interface ListTechnicalRidersOptions {
  /** Inclusive `created_at` range — added for Phase 13.2's Technical Report, the same shape as every other report definition's period filter. Optional and additive: every existing caller (technical-riders/page.tsx) that passes no options is unaffected. */
  createdFrom?: string;
  createdTo?: string;
}

export async function listTechnicalRiders(
  client: SupabaseClient<Database>,
  options: ListTechnicalRidersOptions = {}
): Promise<TechnicalRider[]> {
  let query = client.from("technical_riders").select("*").order("created_at", { ascending: false });
  if (options.createdFrom) query = query.gte("created_at", options.createdFrom);
  if (options.createdTo) query = query.lte("created_at", options.createdTo);
  const { data, error } = await query;
  if (error) throw new ServiceError("Could not load technical riders.", error);
  return (data ?? []).map(mapTechnicalRiderRow);
}

export async function getTechnicalRider(client: SupabaseClient<Database>, id: string): Promise<TechnicalRider | null> {
  const { data, error } = await client.from("technical_riders").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the technical rider.", error);
  return data ? mapTechnicalRiderRow(data) : null;
}

export async function getTechnicalRiderForEvent(
  client: SupabaseClient<Database>,
  eventId: string
): Promise<TechnicalRider | null> {
  const { data, error } = await client.from("technical_riders").select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw new ServiceError("Could not load the technical rider.", error);
  return data ? mapTechnicalRiderRow(data) : null;
}
