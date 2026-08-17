import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapMemberDetail, mapMemberSummary } from "./map";
import { resolveDepartmentAndFamilyNames } from "./resolve-names";
import type { ListMembersOptions, MemberDetail, MemberSummary } from "./types";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];
/** Exactly the columns `mapMemberSummary`/`resolveDepartmentAndFamilyNames` read — see `getMemberByQrToken`'s own comment for why this is deliberately narrower than `select("*")`. */
const MEMBER_ID_CARD_COLUMNS = "id, member_number, first_name, last_name, preferred_name, photo_url, membership_status, primary_department_id, family_id, joined_at";

/**
 * Lists members visible to the caller. No application-layer permission
 * check is applied here — `members_select_scoped` RLS (0004) already
 * limits the result set to: the caller's own record, everything (if they
 * hold `members.profiles.read_all`), or members in the caller's own
 * department/family scope. This function trusts Postgres for that, exactly
 * as Phase 6's `authorize()` doc comments describe RLS as the primary,
 * non-bypassable boundary.
 */
export async function listMembers(
  client: SupabaseClient<Database>,
  options: ListMembersOptions = {}
): Promise<MemberSummary[]> {
  let query = client.from("members").select("*").order("first_name", { ascending: true });

  if (options.membershipStatus) query = query.eq("membership_status", options.membershipStatus);
  if (options.departmentId) query = query.eq("primary_department_id", options.departmentId);
  if (options.familyId) query = query.eq("family_id", options.familyId);
  if (options.search) {
    const term = options.search.trim();
    if (term) {
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
    }
  }
  if (options.joinedFrom) query = query.gte("joined_at", options.joinedFrom);
  if (options.joinedTo) query = query.lte("joined_at", options.joinedTo);

  const { data, error } = await query;
  if (error) {
    throw new ServiceError("Could not load members.", error);
  }

  const names = await resolveDepartmentAndFamilyNames(client, data ?? []);
  return (data ?? []).map((row) => mapMemberSummary(row, names));
}

export async function getMember(client: SupabaseClient<Database>, id: string): Promise<MemberDetail | null> {
  const { data, error } = await client.from("members").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new ServiceError("Could not load the member.", error);
  }
  if (!data) return null;

  const names = await resolveDepartmentAndFamilyNames(client, [data]);
  return mapMemberDetail(data, names);
}

/**
 * Resolves a scanned Member ID QR code (ARCHITECTURE.md S13: "Member ID
 * card (identity display, not raw auth)"). `qr_token` (0004,
 * `default gen_random_uuid() unique`) is the opaque, unguessable,
 * record-bound reference the QR image encodes — never a raw member id or
 * any PII. No new permission or RLS is introduced for this: it is the same
 * `members_select_scoped` policy `getMember` already relies on, just
 * looked up by `qr_token` instead of `id`. That means who a QR scan
 * actually resolves to something for is identical to who could already
 * read that member's profile — the caller themself, anyone holding
 * `members.profiles.read_all` (e.g. front-of-house/security staff), or
 * someone sharing that member's own department/family scope — and for
 * anyone else, this returns `null`, indistinguishable from "no such QR",
 * the same generic-failure shape `applications.getApplicationForApplicant`
 * uses so a caller can't use this as an oracle for which QR tokens exist.
 *
 * Deliberately returns `MemberSummary`, not `MemberDetail` — a security
 * review of this phase flagged that `getMember`'s `select("*")` would pull
 * a scanned member's `national_id_number`, `date_of_birth`, `email`,
 * `phone`, `physical_address`, and emergency-contact fields onto the
 * SCANNING device's own JS runtime for a UI that only ever renders name/
 * number/department/status (`apps/mobile/app/(app)/profile/qr.tsx`). That
 * isn't a new RLS gap (an authorized viewer could already read all of it
 * via `getMember`), but it's an avoidable data-minimization regression
 * specific to a casual "show your badge" scan, fixed here by selecting
 * only the columns an ID card actually needs — the same 10 columns
 * `mapMemberSummary`/`resolveDepartmentAndFamilyNames` read, no more.
 * `data` only carries those 10 columns, so the cast to `MemberRow` below is
 * safe for what both helpers actually touch, even though the real row has
 * more columns Postgres was never asked to return.
 */
export async function getMemberByQrToken(client: SupabaseClient<Database>, qrToken: string): Promise<MemberSummary | null> {
  const { data, error } = await client.from("members").select(MEMBER_ID_CARD_COLUMNS).eq("qr_token", qrToken).maybeSingle();
  if (error) {
    throw new ServiceError("Could not resolve that QR code.", error);
  }
  if (!data) return null;

  const row = data as MemberRow;
  const names = await resolveDepartmentAndFamilyNames(client, [row]);
  return mapMemberSummary(row, names);
}
