import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapGatePassItemRow, mapGatePassRow } from "./map";
import type { GatePass, GatePassItem, GatePassStatus } from "./types";

export interface ListGatePassesOptions {
  status?: GatePassStatus;
  eventId?: string;
}

export async function listGatePasses(client: SupabaseClient<Database>, options: ListGatePassesOptions = {}): Promise<GatePass[]> {
  let query = client.from("gate_passes").select("*");
  if (options.status) query = query.eq("status", options.status);
  if (options.eventId) query = query.eq("event_id", options.eventId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load gate passes.", error);
  return (data ?? []).map(mapGatePassRow);
}

export async function getGatePass(client: SupabaseClient<Database>, id: string): Promise<GatePass | null> {
  const { data, error } = await client.from("gate_passes").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the gate pass.", error);
  return data ? mapGatePassRow(data) : null;
}

export async function listGatePassItems(client: SupabaseClient<Database>, gatePassId: string): Promise<GatePassItem[]> {
  const { data, error } = await client
    .from("gate_pass_items")
    .select("*")
    .eq("gate_pass_id", gatePassId)
    .order("created_at", { ascending: true });
  if (error) throw new ServiceError("Could not load the gate pass's items.", error);
  return (data ?? []).map(mapGatePassItemRow);
}
