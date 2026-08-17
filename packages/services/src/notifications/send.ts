import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapNotificationRow } from "./map";
import type { SendNotificationInput, SendNotificationResult } from "./types";

/**
 * Fans a single composed message out into one `notifications` row per
 * resolved recipient, via the `send_notification` SECURITY DEFINER RPC
 * (0033) — NOT a plain client-side `insert()`. This is a genuinely-required
 * escape hatch, not a stylistic preference: a caller who holds
 * `communications.notifications.send` but not also `communications.
 * notifications.read_all`/`admin.users.read`/`members.profiles.read_all`
 * (exactly `pro_spokesperson`'s real grant shape) cannot resolve an `all`/
 * `department`/`family` audience through their own RLS-scoped session at
 * all — `users_select_self`/`members_select_scoped` RLS narrows those reads
 * to their own row — and even a `specific_users` send to anyone else would
 * fail: Postgres requires every row an `INSERT ... RETURNING` returns to
 * also satisfy the table's SELECT policy, so `notifications_select_own`
 * (recipient = self OR `.read_all`) would abort the ENTIRE multi-row
 * insert the moment any row targeted someone other than the sender. This
 * was the actual, original shape of this function — found broken by this
 * phase's own security review (verified directly against a live
 * `pro_spokesperson` session: it could only ever successfully notify
 * itself) and replaced with 0033's RPC, which resolves the audience and
 * performs the insert inside a SECURITY DEFINER context immune to both
 * restrictions, gated on the identical `has_permission('communications.
 * notifications.send')` check `notifications_insert_service` RLS already
 * requires. See 0033's own doc comment for the full bug writeup.
 */
export async function sendNotification(client: SupabaseClient<Database>, input: SendNotificationInput): Promise<SendNotificationResult> {
  const body = input.body.trim();
  if (!body) throw new ServiceError("A message body is required.");

  if (input.audience === "department" && !input.departmentId) throw new ServiceError("A department is required for this audience.");
  if (input.audience === "family" && !input.familyId) throw new ServiceError("A family is required for this audience.");
  const userIds =
    input.audience === "specific_users"
      ? Array.from(new Set((input.userIds ?? []).map((id) => id.trim()).filter(Boolean)))
      : null;
  if (input.audience === "specific_users" && (!userIds || userIds.length === 0)) {
    throw new ServiceError("At least one user ID is required for this audience.");
  }

  const { data, error } = await client.rpc("send_notification", {
    p_audience: input.audience,
    p_department_id: input.departmentId ?? null,
    p_family_id: input.familyId ?? null,
    p_user_ids: userIds,
    p_channel: input.channel,
    p_subject: input.subject?.trim() || null,
    p_body: body,
    p_template_id: input.templateId ?? null,
    p_triggering_event: input.triggeringEvent ?? null,
    p_triggering_record_type: input.triggeringRecordType ?? null,
    p_triggering_record_id: input.triggeringRecordId ?? null,
  });
  if (error) throw new ServiceError(error.message || "Could not send the notification.", error);

  const notifications = (data ?? []).map(mapNotificationRow);
  return { recipientCount: notifications.length, notifications };
}
