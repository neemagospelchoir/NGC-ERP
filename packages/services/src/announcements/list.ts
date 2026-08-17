import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapAnnouncementRow } from "./map";
import type { Announcement } from "./types";

/**
 * Reads every announcement the caller's own RLS session can see.
 * `announcements_select_published` (0016, widened by 0032 — see that
 * migration's own doc comment) lets any signed-in user see a row while it
 * is live (`publish_at` has passed and it hasn't expired), and additionally
 * lets the row's own author or any `communications.announcements.manage`
 * holder see it regardless of that window — so this single query naturally
 * serves both "what's live for me right now" (a plain member) and "every
 * announcement I've authored or can manage, live or not" (a manager),
 * with no separate manage-only variant needed.
 */
export async function listAnnouncements(client: SupabaseClient<Database>): Promise<Announcement[]> {
  const { data, error } = await client.from("announcements").select("*").order("publish_at", { ascending: false });
  if (error) throw new ServiceError("Could not load announcements.", error);
  return (data ?? []).map(mapAnnouncementRow);
}

export async function getAnnouncement(client: SupabaseClient<Database>, id: string): Promise<Announcement | null> {
  const { data, error } = await client.from("announcements").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError("Could not load the announcement.", error);
  return data ? mapAnnouncementRow(data) : null;
}
