import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";

export interface DisciplineMemberLookup {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string;
  membershipStatus: string;
}

/**
 * Resolves an EXACT member_number to the member it belongs to, via the
 * `find_member_by_number_for_discipline` SECURITY DEFINER function (0026)
 * — not a `.from("members")` query, because a Discipline Manager has no
 * general read grant on `members` (RLS only lets them see a member who
 * already has a case on file, which is never true for the member a NEW
 * case is being opened against). The function itself re-checks
 * `discipline.cases.manage` and returns zero rows for anyone who doesn't
 * hold it or for a number that doesn't exist — same "fail closed with a
 * generic empty result" shape as `applications/applicant-access.ts`'s
 * token check, so a caller can't distinguish "wrong permission" from
 * "no such member" by response shape.
 *
 * Every call — match or no match — is audit-logged by the DB function
 * itself (0027): `member_number` is sequential/guessable, so this is the
 * one place a Discipline Manager could otherwise enumerate the whole
 * membership directory well beyond their "read own cases only" grant.
 * The audit trail is a detective control (a reviewable pattern of many
 * distinct lookups), not a preventive one — this codebase has no
 * request-rate-limiting infrastructure to actually block enumeration
 * outright, which is flagged as a known residual risk in docs/PHASE_7_4.md
 * rather than silently treated as solved.
 */
export async function findMemberByNumber(client: SupabaseClient<Database>, memberNumber: string): Promise<DisciplineMemberLookup> {
  const trimmed = memberNumber.trim();
  if (!trimmed) {
    throw new ServiceError("A member number is required.");
  }

  const { data, error } = await client.rpc("find_member_by_number_for_discipline", { p_member_number: trimmed });
  if (error) throw new ServiceError("Could not look up that member.", error);

  const row = data?.[0];
  if (!row) {
    throw new ServiceError(`No member found with number "${trimmed}".`);
  }

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    memberNumber: row.member_number,
    membershipStatus: row.membership_status,
  };
}
