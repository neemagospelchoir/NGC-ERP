import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapNotificationRow } from "./map";
import type { Notification } from "./types";

/**
 * The explicit, application-level equivalent of `notifications_select_own`
 * RLS's self-row clause — used by the "My notifications" inbox so any
 * signed-in user sees their own notifications regardless of whether they
 * also hold `communications.notifications.read_all`, the same belt-and-
 * suspenders pairing as `expenses.listExpenseRequestsForRequester`.
 */
export async function listMyNotifications(client: SupabaseClient<Database>, recipientUserId: string): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", recipientUserId)
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError("Could not load your notifications.", error);
  return (data ?? []).map(mapNotificationRow);
}

/**
 * Marks a single notification read. Gated on `notifications_update_own_read`
 * RLS (0016) — `recipient_user_id = auth.uid()` only, no permission-based
 * bypass at all (unlike most other write policies in this schema), so even
 * `communications.notifications.read_all`'s cross-reader visibility never
 * lets anyone mark someone ELSE's notification read on their behalf. If the
 * caller isn't the recipient, RLS filters the update to 0 rows and
 * `.single()` errors (PGRST116) — fails closed, the same shape
 * `announcements.updateAnnouncement` relies on.
 */
export async function markNotificationRead(client: SupabaseClient<Database>, id: string): Promise<Notification> {
  const { data, error } = await client
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new ServiceError("Could not mark the notification as read.", error);
  return mapNotificationRow(data);
}
