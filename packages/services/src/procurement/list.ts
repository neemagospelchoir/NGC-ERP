import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapProcurementRequestRow, mapPurchaseOrderRow } from "./map";
import type { ProcurementRequest, PurchaseOrder } from "./types";

export async function listProcurementRequests(client: SupabaseClient<Database>): Promise<ProcurementRequest[]> {
  const { data, error } = await client.from("procurement_requests").select("*").order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load procurement requests.", error);
  return (data ?? []).map(mapProcurementRequestRow);
}

export async function getProcurementRequest(client: SupabaseClient<Database>, id: string): Promise<ProcurementRequest | null> {
  const { data, error } = await client.from("procurement_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the procurement request.", error);
  return data ? mapProcurementRequestRow(data) : null;
}

export async function listProcurementRequestsForExpense(
  client: SupabaseClient<Database>,
  expenseRequestId: string
): Promise<ProcurementRequest[]> {
  const { data, error } = await client
    .from("procurement_requests")
    .select("*")
    .eq("expense_request_id", expenseRequestId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load procurement requests for this expense.", error);
  return (data ?? []).map(mapProcurementRequestRow);
}

export async function listPurchaseOrders(client: SupabaseClient<Database>, procurementRequestId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await client
    .from("purchase_orders")
    .select("*")
    .eq("procurement_request_id", procurementRequestId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load purchase orders.", error);
  return (data ?? []).map(mapPurchaseOrderRow);
}

export async function getPurchaseOrder(client: SupabaseClient<Database>, id: string): Promise<PurchaseOrder | null> {
  const { data, error } = await client.from("purchase_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the purchase order.", error);
  return data ? mapPurchaseOrderRow(data) : null;
}
